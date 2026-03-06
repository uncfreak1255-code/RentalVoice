create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null,
  event_name text not null,
  source text,
  properties jsonb not null default '{}'::jsonb,
  client_occurred_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_events_org_created_at
  on public.product_events (org_id, created_at desc);

create index if not exists idx_product_events_category_name
  on public.product_events (category, event_name, created_at desc);
