-- Medalia activation codes, issued from a pool at Lifeline checkout.
--
-- Mads, 2026-10-15 (option B): the health check is paid in Lifeline through
-- Straumur. Medalia generates 100% discount codes in batches (e.g. 1000, as
-- JSON); they are imported here, and each paid order draws exactly one,
-- which the customer enters in the patient portal (Medalia) to start the
-- check. Until now checkout invented its own LL-XXXX-XXXX codes, which
-- Medalia does not know.
--
-- Each code is worth a full health check, so:
--   • stored encrypted (encrypt_text / decrypt_text, the pgcrypto + Vault key
--     from migration-encryption-foundation.sql); code_hash only for
--     uniqueness, so the same code can never be imported twice
--   • the table is closed to clients (RLS false); only the SECURITY DEFINER
--     functions below touch it, and only the service role may call them
--   • claimed with FOR UPDATE SKIP LOCKED: two simultaneous checkouts can
--     never get the same code
--   • once issued, the code is written to hc_orders.activation_code (where
--     every surface already reads it) and the pool row records the order
--
-- kinds: which hc_packages.kind a code is for (health_check, reevaluation,
-- followup_3m, extra_followup); null = any. Medalia may issue one pool per
-- package type.
--
-- Code: src/lib/hc/code-pool.ts, src/app/api/hc/checkout/route.ts,
--       src/app/api/admin/hc/activation-codes/route.ts
-- Idempotent. Applied with `supabase db query --linked -f`.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.hc_activation_code_pool (
  id           uuid primary key default gen_random_uuid(),
  code_enc     bytea not null,
  code_hash    text not null unique,
  kinds        text[],
  batch        text,
  status       text not null default 'available' check (status in ('available', 'issued', 'void')),
  order_id     uuid references public.hc_orders(id) on delete set null,
  client_id    uuid,
  imported_at  timestamptz not null default now(),
  issued_at    timestamptz,
  voided_at    timestamptz,
  void_reason  text
);
create index if not exists hc_activation_code_pool_avail_idx on public.hc_activation_code_pool (status, imported_at);
create index if not exists hc_activation_code_pool_order_idx on public.hc_activation_code_pool (order_id);

-- One issued code per order, enforced by the database as well (security
-- review 2026-10-15).
create unique index if not exists hc_activation_code_pool_order_issued_uniq
  on public.hc_activation_code_pool (order_id) where status = 'issued';

alter table public.hc_activation_code_pool enable row level security;
drop policy if exists "hc_activation_code_pool no client access" on public.hc_activation_code_pool;
create policy "hc_activation_code_pool no client access" on public.hc_activation_code_pool
  for all using (false) with check (false);

-- Normalised for hashing: what a person might type differently.
create or replace function public.hc_code_norm(p text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')) $$;

-- Import a batch. Duplicates (already in the pool) are skipped, not errors.
create or replace function public.hc_import_activation_codes(p_codes text[], p_kinds text[], p_batch text)
returns table (inserted integer, duplicates integer)
language plpgsql security definer set search_path = public as $$
declare n_in integer := 0; n_total integer := 0; c text;
begin
  foreach c in array p_codes loop
    if public.hc_code_norm(c) = '' then continue; end if;
    n_total := n_total + 1;
    insert into public.hc_activation_code_pool (code_enc, code_hash, kinds, batch)
    values (public.encrypt_text(trim(c)), encode(extensions.digest(public.hc_code_norm(c), 'sha256'), 'hex'), p_kinds, p_batch)
    on conflict (code_hash) do nothing;
    if found then n_in := n_in + 1; end if;
  end loop;
  return query select n_in, n_total - n_in;
end $$;

-- Draw one code for a paid order. Null when the pool for that kind is empty.
-- Idempotent per order: asking again returns the code already issued to it.
create or replace function public.hc_claim_activation_code(p_order uuid, p_client uuid, p_kind text)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.hc_activation_code_pool%rowtype;
begin
  -- Serialise callers for the same order (two concurrent imports assigning
  -- waiting orders): without this both could pass the check below, each
  -- issue a different code, and one would be orphaned yet live in Medalia.
  perform pg_advisory_xact_lock(hashtext('hc_code:' || p_order::text));
  select * into r from public.hc_activation_code_pool where order_id = p_order and status = 'issued' limit 1;
  if found then return public.decrypt_text(r.code_enc); end if;

  select * into r from public.hc_activation_code_pool
   where status = 'available' and (kinds is null or p_kind = any(kinds))
   order by imported_at, id
   limit 1
   for update skip locked;
  if not found then return null; end if;

  update public.hc_activation_code_pool
     set status = 'issued', order_id = p_order, client_id = p_client, issued_at = now()
   where id = r.id;
  return public.decrypt_text(r.code_enc);
end $$;

-- Void the code issued to an order (refund / cancellation). Returns the code
-- so it can be sent to Medalia for deactivation; null if there was none.
create or replace function public.hc_void_activation_code(p_order uuid, p_reason text)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.hc_activation_code_pool%rowtype;
begin
  update public.hc_activation_code_pool
     set status = 'void', voided_at = now(), void_reason = left(coalesce(p_reason, ''), 500)
   where order_id = p_order and status = 'issued'
  returning * into r;
  if not found then return null; end if;
  return public.decrypt_text(r.code_enc);
end $$;

-- Stock per kind ('*' = codes valid for any kind).
create or replace function public.hc_activation_code_stock()
returns table (kind text, available bigint, issued bigint, void bigint)
language sql security definer set search_path = public as $$
  select coalesce(k, '*') as kind,
         count(*) filter (where status = 'available'),
         count(*) filter (where status = 'issued'),
         count(*) filter (where status = 'void')
    from (select status, unnest(coalesce(kinds, array[null::text])) as k from public.hc_activation_code_pool) t
   group by coalesce(k, '*')
   order by 1;
$$;

revoke all on function public.hc_import_activation_codes(text[], text[], text) from public, anon, authenticated;
revoke all on function public.hc_claim_activation_code(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.hc_void_activation_code(uuid, text) from public, anon, authenticated;
revoke all on function public.hc_activation_code_stock() from public, anon, authenticated;
grant execute on function public.hc_import_activation_codes(text[], text[], text) to service_role;
grant execute on function public.hc_claim_activation_code(uuid, uuid, text) to service_role;
grant execute on function public.hc_void_activation_code(uuid, text) to service_role;
grant execute on function public.hc_activation_code_stock() to service_role;
