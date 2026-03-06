-- Phase 4/5 bridge: snapshot table for migrating local learning into commercial backend

CREATE TABLE IF NOT EXISTS learning_migration_snapshots (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  imported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stable_account_id TEXT,
  source TEXT NOT NULL DEFAULT 'mobile_local_store_v1',
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_migration_snapshots_org_time
  ON learning_migration_snapshots(org_id, imported_at DESC);

ALTER TABLE learning_migration_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'learning_migration_snapshots'
      AND policyname = 'learning_migration_snapshots_select_own'
  ) THEN
    CREATE POLICY "learning_migration_snapshots_select_own"
      ON learning_migration_snapshots FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_members.org_id = learning_migration_snapshots.org_id
            AND org_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'learning_migration_snapshots'
      AND policyname = 'learning_migration_snapshots_insert_owner_admin'
  ) THEN
    CREATE POLICY "learning_migration_snapshots_insert_owner_admin"
      ON learning_migration_snapshots FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_members.org_id = learning_migration_snapshots.org_id
            AND org_members.user_id = auth.uid()
            AND org_members.role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

