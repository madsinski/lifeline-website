-- Email subscribers captured from the coming-soon landing page
create table if not exists public.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'coming-soon',
  user_agent text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_subscribers_created_idx
  on public.email_subscribers (created_at desc);

alter table public.email_subscribers enable row level security;

-- Anyone can insert (signup from landing page)
drop policy if exists "anon can subscribe" on public.email_subscribers;
create policy "anon can subscribe"
  on public.email_subscribers
  for insert
  to anon, authenticated
  with check (true);

-- Only authenticated staff can read / update / delete
drop policy if exists "authenticated can read" on public.email_subscribers;
create policy "authenticated can read"
  on public.email_subscribers
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated can update" on public.email_subscribers;
create policy "authenticated can update"
  on public.email_subscribers
  for update
  to authenticated
  using (true);

drop policy if exists "authenticated can delete" on public.email_subscribers;
create policy "authenticated can delete"
  on public.email_subscribers
  for delete
  to authenticated
  using (true);
