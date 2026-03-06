-- Milestone 2: Supermemory entitlements + usage metering + addon state

DO $$
BEGIN
  CREATE TYPE supermemory_mode AS ENUM ('off', 'full', 'degraded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS org_entitlements (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL DEFAULT 'starter',
  supermemory_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  supermemory_mode supermemory_mode NOT NULL DEFAULT 'off',
  supermemory_write_limit_monthly INTEGER NOT NULL DEFAULT 0,
  supermemory_read_limit_monthly INTEGER NOT NULL DEFAULT 0,
  supermemory_retention_days INTEGER NOT NULL DEFAULT 30,
  supermemory_top_k INTEGER NOT NULL DEFAULT 0,
  supermemory_cross_property BOOLEAN NOT NULL DEFAULT FALSE,
  supermemory_team_shared BOOLEAN NOT NULL DEFAULT FALSE,
  supermemory_trial_ends_at TIMESTAMPTZ,
  supermemory_addon_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supermemory_usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,
  memory_reads INTEGER NOT NULL DEFAULT 0,
  memory_writes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, period_month)
);

CREATE TABLE IF NOT EXISTS org_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  addon_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  UNIQUE(org_id, addon_code)
);

INSERT INTO org_entitlements (org_id, plan_tier)
SELECT id, 'starter'
FROM organizations
ON CONFLICT (org_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_supermemory_usage_org_month
  ON supermemory_usage_monthly(org_id, period_month);

ALTER TABLE org_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermemory_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_addons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_entitlements_select_own"
    ON org_entitlements FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = org_entitlements.org_id
        AND org_members.user_id = auth.uid()
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_entitlements_update_owner_admin"
    ON org_entitlements FOR UPDATE
    USING (EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = org_entitlements.org_id
        AND org_members.user_id = auth.uid()
        AND org_members.role IN ('owner', 'admin')
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "supermemory_usage_select_own"
    ON supermemory_usage_monthly FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = supermemory_usage_monthly.org_id
        AND org_members.user_id = auth.uid()
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_addons_select_own"
    ON org_addons FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = org_addons.org_id
        AND org_members.user_id = auth.uid()
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
