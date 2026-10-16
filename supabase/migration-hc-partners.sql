-- Vera heilsusetur partners, and contacting them on a client's behalf.
--
-- Mads, 2026-10-15: Lifeline does not refer patients. What it does is email
-- a partner at Vera heilsusetur (psychologist, nutritionist, physiotherapist)
-- on the client's behalf, with the client's consent, carrying ONLY name,
-- kennitala and contact details — never the reason or any health data. The
-- old flow ended at "Samþykkt" with nothing sent and nothing anyone could act
-- on.
--
--   hc_partners          the register (admin → Heilsuferð → Samstarfsaðilar)
--   hc_referrals.*       a partner contact is a referral row with target
--                        physio / psychologist / nutritionist plus:
--                        partner_id, consent_at/by (the nurse confirmed the
--                        client agreed), sent_at/by, contacted_at. Status:
--                        'sent' (emailed), 'failed' (email did not go),
--                        'done' (contact made). These never wait on a doctor.
--
-- Code: src/lib/hc/referrals.ts, src/app/api/vinnustod/journeys/[id]/referrals,
--       src/app/api/admin/hc/partners, src/app/api/vinnustod/partners
-- Idempotent. Applied with `supabase db query --linked -f`.

create table if not exists public.hc_partners (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  profession    text not null check (profession in ('physio', 'psychologist', 'nutritionist')),
  organization  text not null default 'Vera heilsusetur',
  email         text not null,
  phone         text,
  note          text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists hc_partners_profession_idx on public.hc_partners (profession) where active;

alter table public.hc_partners enable row level security;
drop policy if exists "hc_partners no client access" on public.hc_partners;
create policy "hc_partners no client access" on public.hc_partners for all using (false) with check (false);
-- No direct staff read: the API is the only path (emails stay server-side).
drop policy if exists "hc_partners staff read" on public.hc_partners;

alter table public.hc_referrals add column if not exists partner_id   uuid references public.hc_partners(id) on delete set null;
alter table public.hc_referrals add column if not exists consent_at   timestamptz;
alter table public.hc_referrals add column if not exists consent_by   text;
alter table public.hc_referrals add column if not exists sent_at      timestamptz;
alter table public.hc_referrals add column if not exists sent_by      text;
alter table public.hc_referrals add column if not exists contacted_at timestamptz;
