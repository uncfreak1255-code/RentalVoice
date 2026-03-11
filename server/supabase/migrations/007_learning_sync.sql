-- Learning profile sync: stores AI voice learning data per organization
-- Enables restore after app reinstall/container reset

create table if not exists public.learning_profiles (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  style_profiles_json jsonb not null default '{}'::jsonb,
  training_progress_json jsonb not null default '{}'::jsonb,
  incremental_state_json jsonb not null default '{}'::jsonb,
  temporal_weights_json jsonb not null default '{}'::jsonb,
  training_quality_json jsonb not null default '{}'::jsonb,
  conversation_flows_json jsonb not null default '{}'::jsonb,
  guest_memory_json jsonb not null default '{}'::jsonb,
  negative_examples_json jsonb not null default '{}'::jsonb,
  draft_outcomes_json jsonb not null default '{}'::jsonb,
  total_examples_synced integer not null default 0,
  sync_version integer not null default 1,
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Few-shot examples: individual guest/host message pairs used for voice matching
create table if not exists public.few_shot_examples (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  guest_message text not null,
  host_response text not null,
  guest_intent text,
  property_id text,
  origin_type text check (origin_type in ('host_written', 'ai_approved', 'ai_edited')),
  created_at timestamptz not null default now()
);

create index if not exists idx_few_shot_examples_org_created
  on public.few_shot_examples (org_id, created_at desc);

create index if not exists idx_few_shot_examples_org_origin
  on public.few_shot_examples (org_id, origin_type);

-- RLS policies: org members can only access their own data
alter table public.learning_profiles enable row level security;
alter table public.few_shot_examples enable row level security;

-- Service role bypass (server routes use admin client)
create policy "Service role full access on learning_profiles"
  on public.learning_profiles for all
  using (true)
  with check (true);

create policy "Service role full access on few_shot_examples"
  on public.few_shot_examples for all
  using (true)
  with check (true);
