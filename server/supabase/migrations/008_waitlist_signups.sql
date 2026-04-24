create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'landing',
  created_at timestamptz not null default now(),
  constraint waitlist_signups_email_length check (char_length(email) <= 320),
  constraint waitlist_signups_email_normalized check (email = lower(btrim(email))),
  constraint waitlist_signups_source_normalized check (source = btrim(source)),
  constraint waitlist_signups_source_length check (char_length(source) between 1 and 100)
);

alter table public.waitlist_signups enable row level security;

create unique index if not exists idx_waitlist_signups_email_lower
  on public.waitlist_signups (lower(email));

create index if not exists idx_waitlist_signups_created_at
  on public.waitlist_signups (created_at desc);
