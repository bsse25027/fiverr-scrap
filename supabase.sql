create table if not exists public.fiverr_review_buyers (
  id bigint generated always as identity primary key,
  username text not null unique,
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

create index if not exists fiverr_review_buyers_last_seen_at_idx
  on public.fiverr_review_buyers (last_seen_at desc);

create index if not exists fiverr_review_buyers_done_idx
  on public.fiverr_review_buyers (done);

alter table public.fiverr_review_buyers enable row level security;

drop policy if exists "No public access" on public.fiverr_review_buyers;
create policy "No public access"
  on public.fiverr_review_buyers
  for all
  using (false)
  with check (false);
