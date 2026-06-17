-- Per-roster-member health-check cost-item state (per-CLIENT cost lines).
--
-- The roster (company_members) is the source of truth: each member served
-- gets a cost line per category. This table only stores the editable STATUS
-- overlay (paid/covered/deferred/price/provider/note/order). Company totals
-- roll up from these lines; company_cost_item_status remains the per-company
-- DEFAULT a member line falls back to (and still owns the `doctor` category /
-- salary split). Keyed on company_members.id because company_members.client_id
-- is null until a member onboards — the roster row id is the only stable key.
--
-- Applied manually in the Supabase SQL editor. Idempotent.

create table if not exists client_cost_item_status (
  member_id      uuid not null references company_members(id) on delete cascade,
  category       text not null check (category in ('blood_tests','measurements')),
  status         text not null default 'auto'
    check (status in ('auto','outstanding','invoice_pending','covered','not_applicable')),
  provider       text,
  staff_id       uuid references staff(id) on delete set null,
  unit_price_isk integer check (unit_price_isk >= 0),
  deferred       boolean not null default false,
  note           text,
  sort_order     integer not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (member_id, category)
);

-- Belt-and-suspenders for re-runs against an older copy of the table.
alter table client_cost_item_status add column if not exists note text;
alter table client_cost_item_status add column if not exists sort_order integer not null default 0;

create index if not exists idx_client_cost_item_status_member
  on client_cost_item_status (member_id);

-- API-mediated table: block all direct client access; writes go through
-- /api/admin/accounting/cost-items using supabaseAdmin.
alter table client_cost_item_status enable row level security;
drop policy if exists "Block client access" on client_cost_item_status;
create policy "Block client access" on client_cost_item_status
  for all using (false) with check (false);

notify pgrst, 'reload schema';
