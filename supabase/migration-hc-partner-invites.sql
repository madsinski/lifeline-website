-- Ábyrgðarfélagi invitations by email.
--
-- friendships can only link two rows that already exist, so there was no way
-- to ask somebody who is not yet a member — the candidate list was empty
-- until a friendship existed, with nothing on the page that could create
-- one. This table is the waiting room: an email address and a token, which
-- becomes a friendships row the moment the invitee accepts.
--
-- ── The privacy property that matters ─────────────────────────────────
--
-- An invite must never reveal whether an address already belongs to a
-- Lifeline member. Who is a customer of a health service is information
-- about that person, and a form that answers "already a member" / "not a
-- member" is a membership oracle anybody can query. So the API returns the
-- same response either way and this table accepts any address without
-- checking it against clients.
--
-- Nothing is shared on invite. Accepting is what creates the friendship,
-- and the invitee sees the inviter's name — which the inviter chose to
-- disclose by inviting them — and nothing else about them.
--
-- API: src/app/api/hc/partner/route.ts (POST { invite_email })
--      src/app/api/hc/partner/accept/route.ts (POST { token })

create table if not exists hc_partner_invites (
  id          uuid primary key default gen_random_uuid(),
  inviter_id  uuid not null references clients(id) on delete cascade,
  -- Stored lowercased and trimmed; the API is the only writer.
  email       text not null,
  token       text not null unique,
  status      text not null default 'pending'
                check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references clients(id) on delete set null
);

create index if not exists hc_partner_invites_inviter_idx on hc_partner_invites (inviter_id);
create index if not exists hc_partner_invites_token_idx   on hc_partner_invites (token);
-- One live invitation per address per inviter: re-inviting resends rather
-- than piling up rows, and it stops the form being used to mail somebody
-- repeatedly.
create unique index if not exists hc_partner_invites_live_idx
  on hc_partner_invites (inviter_id, lower(email))
  where status = 'pending';

alter table hc_partner_invites enable row level security;

-- API-mediated: every read and write goes through the route with
-- supabaseAdmin. A token is a credential, so the anon key must never be
-- able to read this table and enumerate them.
drop policy if exists "Block client access" on hc_partner_invites;
create policy "Block client access" on hc_partner_invites
  for all using (false) with check (false);
