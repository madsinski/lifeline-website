-- Encrypt stored health reports (hc_reports.payload) at column level, the
-- same way messages.content and clients PII are (pgcrypto + Vault key, see
-- migration-encryption-foundation.sql). Also records who put the report in:
-- the participant themself, or staff on the participant's behalf at their
-- request (source + on_behalf_consent_at).
--
-- Writers keep inserting `payload`; a trigger encrypts it into payload_enc and
-- blanks the plaintext. Readers call hc_report_latest() (service role only).
-- Idempotent.

alter table public.hc_reports add column if not exists payload_enc bytea;
alter table public.hc_reports add column if not exists source text not null default 'staff'
  check (source in ('self', 'staff_on_behalf', 'staff', 'intake'));
alter table public.hc_reports add column if not exists on_behalf_consent_at timestamptz;
alter table public.hc_reports alter column payload drop not null;

create or replace function public.hc_reports_encrypt() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.payload is not null then
    new.payload_enc := public.encrypt_text(new.payload::text);
    new.payload := null;
  end if;
  return new;
end $$;
revoke all on function public.hc_reports_encrypt() from public;

drop trigger if exists hc_reports_encrypt on public.hc_reports;
create trigger hc_reports_encrypt before insert or update of payload on public.hc_reports
  for each row execute function public.hc_reports_encrypt();

-- Backfill: touching payload fires the trigger.
update public.hc_reports set payload = payload where payload is not null;

create or replace function public.hc_report_latest(p_journey uuid)
returns table (payload jsonb, method text, source text, created_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select public.decrypt_text(r.payload_enc)::jsonb, r.method, r.source, r.created_at
  from public.hc_reports r
  where r.journey_id = p_journey and r.payload_enc is not null
  order by r.created_at desc
  limit 1
$$;
revoke all on function public.hc_report_latest(uuid) from public, anon, authenticated;
grant execute on function public.hc_report_latest(uuid) to service_role;
