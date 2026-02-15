-- Rental Voice — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- 
-- Creates core tables for multi-tenant commercial operation.
-- All tables use RLS policies — users only see their org's data.

-- ============================================================
-- Users & Organizations
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'business', 'enterprise')),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- ============================================================
-- PMS Connections
-- ============================================================

CREATE TABLE IF NOT EXISTS pms_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('hostaway', 'guesty', 'hospitable')),
  account_id TEXT NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  oauth_token TEXT,
  oauth_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'error')),
  UNIQUE (org_id, provider, account_id)
);

-- ============================================================
-- AI Configuration
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'managed' CHECK (mode IN ('managed', 'byok')),
  provider TEXT CHECK (provider IN ('openai', 'anthropic', 'google')),
  encrypted_api_key TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id)
);

-- ============================================================
-- Property Knowledge
-- ============================================================

CREATE TABLE IF NOT EXISTS property_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  wifi_name TEXT,
  wifi_password TEXT,
  check_in TEXT,
  check_out TEXT,
  parking TEXT,
  rules TEXT,
  tone TEXT,
  photos_json JSONB DEFAULT '[]'::JSONB,
  custom_fields JSONB DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, property_id)
);

-- ============================================================
-- AI Usage Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM format
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  requests INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  UNIQUE (org_id, month, provider)
);

-- ============================================================
-- Organization Settings
-- ============================================================

CREATE TABLE IF NOT EXISTS org_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  default_language TEXT NOT NULL DEFAULT 'en',
  response_language_mode TEXT NOT NULL DEFAULT 'match_guest',
  autopilot_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  autopilot_threshold INTEGER NOT NULL DEFAULT 85,
  notification_categories_json JSONB DEFAULT '{}'::JSONB,
  quiet_hours_json JSONB DEFAULT '{}'::JSONB,
  muted_properties_json JSONB DEFAULT '[]'::JSONB,
  UNIQUE (org_id)
);

-- ============================================================
-- Learning Data
-- ============================================================

CREATE TABLE IF NOT EXISTS edit_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id TEXT,
  original TEXT NOT NULL,
  edited TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS host_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id TEXT,
  profile_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  samples_analyzed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, property_id)
);

-- ============================================================
-- Row-Level Security Policies
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_style_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own record
CREATE POLICY users_self_read ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_self_update ON users
  FOR UPDATE USING (id = auth.uid());

-- Org members can read their org
CREATE POLICY org_members_read ON organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- Org members can read their membership
CREATE POLICY org_members_self_read ON org_members
  FOR SELECT USING (user_id = auth.uid());

-- Org-scoped tables: members can read their org's data
CREATE POLICY pms_connections_org ON pms_connections
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY ai_configs_org ON ai_configs
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY property_knowledge_org ON property_knowledge
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY ai_usage_org ON ai_usage
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY org_settings_org ON org_settings
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY edit_patterns_org ON edit_patterns
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY host_style_profiles_org ON host_style_profiles
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_pms_connections_org ON pms_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_month ON ai_usage(org_id, month);
CREATE INDEX IF NOT EXISTS idx_edit_patterns_org ON edit_patterns(org_id, property_id);
CREATE INDEX IF NOT EXISTS idx_host_style_profiles_org ON host_style_profiles(org_id, property_id);
CREATE INDEX IF NOT EXISTS idx_property_knowledge_org ON property_knowledge(org_id, property_id);
