-- Private beta intake tables (MKT-02)
-- Run this in Supabase SQL Editor.

create table if not exists public.beta_signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text not null,
  name text not null,
  use_case_note text null,
  signup_source text not null default 'beta',
  created_at timestamptz not null default now()
);

create unique index if not exists beta_signups_email_key on public.beta_signups (lower(email));

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  use_case_note text null,
  signup_source text not null default 'waitlist',
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_email_key on public.waitlist (lower(email));

-- Keep tables locked down; inserts happen through server routes using service role.
alter table public.beta_signups enable row level security;
alter table public.waitlist enable row level security;

drop policy if exists "beta_signups no access" on public.beta_signups;
create policy "beta_signups no access"
on public.beta_signups
for all
to authenticated, anon
using (false)
with check (false);

drop policy if exists "waitlist no access" on public.waitlist;
create policy "waitlist no access"
on public.waitlist
for all
to authenticated, anon
using (false)
with check (false);

