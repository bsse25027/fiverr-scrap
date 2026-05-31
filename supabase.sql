create table if not exists public.fiverr_gigs (
  gig_key text primary key,
  gig_url text not null,
  title text,
  seller_username text,
  seller_profile_image_url text,
  gig_image_url text,
  description text,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists fiverr_gigs_gig_url_idx
  on public.fiverr_gigs (gig_url);

create index if not exists fiverr_gigs_last_seen_at_idx
  on public.fiverr_gigs (last_seen_at desc);

insert into public.fiverr_gigs (gig_key, gig_url, title, seller_username)
values ('unknown', 'unknown', 'Unknown gig', 'Unknown seller')
on conflict (gig_key) do nothing;

create table if not exists public.fiverr_review_buyers (
  id bigint generated always as identity primary key,
  username text not null,
  profile_image_url text not null,
  country text,
  rating numeric,
  review text,
  gig_url text,
  source_url text,
  raw jsonb not null default '{}'::jsonb,
  done boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.fiverr_review_buyers
  add column if not exists gig_key text;

update public.fiverr_review_buyers
set gig_key = 'unknown'
where gig_key is null;

alter table public.fiverr_review_buyers
  alter column gig_key set default 'unknown';

alter table public.fiverr_review_buyers
  alter column gig_key set not null;

alter table public.fiverr_review_buyers
  drop constraint if exists fiverr_review_buyers_username_key;

alter table public.fiverr_review_buyers
  drop constraint if exists fiverr_review_buyers_gig_key_fkey;

alter table public.fiverr_review_buyers
  add constraint fiverr_review_buyers_gig_key_fkey
  foreign key (gig_key)
  references public.fiverr_gigs (gig_key)
  on delete cascade;

alter table public.fiverr_review_buyers
  drop constraint if exists fiverr_review_buyers_gig_key_username_key;

alter table public.fiverr_review_buyers
  add constraint fiverr_review_buyers_gig_key_username_key
  unique (gig_key, username);

create index if not exists fiverr_review_buyers_last_seen_at_idx
  on public.fiverr_review_buyers (last_seen_at desc);

create index if not exists fiverr_review_buyers_done_idx
  on public.fiverr_review_buyers (done);

create index if not exists fiverr_review_buyers_gig_key_idx
  on public.fiverr_review_buyers (gig_key);

alter table public.fiverr_gigs enable row level security;
alter table public.fiverr_review_buyers enable row level security;

drop policy if exists "No public access" on public.fiverr_gigs;
create policy "No public access"
  on public.fiverr_gigs
  for all
  using (false)
  with check (false);

drop policy if exists "No public access" on public.fiverr_review_buyers;
create policy "No public access"
  on public.fiverr_review_buyers
  for all
  using (false)
  with check (false);
