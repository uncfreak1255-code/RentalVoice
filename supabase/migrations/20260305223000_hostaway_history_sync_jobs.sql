CREATE TABLE IF NOT EXISTS hostaway_history_sync_jobs (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  phase TEXT NOT NULL DEFAULT 'idle',
  date_range_months INTEGER NOT NULL DEFAULT 24,
  processed_conversations INTEGER NOT NULL DEFAULT 0,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  processed_messages INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hostaway_history_sync_jobs_org_created
  ON hostaway_history_sync_jobs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hostaway_history_sync_jobs_org_status
  ON hostaway_history_sync_jobs(org_id, status);

ALTER TABLE hostaway_history_sync_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hostaway_history_sync_jobs'
      AND policyname = 'hostaway_history_sync_jobs_select_own'
  ) THEN
    CREATE POLICY "hostaway_history_sync_jobs_select_own"
      ON hostaway_history_sync_jobs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_members.org_id = hostaway_history_sync_jobs.org_id
            AND org_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hostaway_history_sync_jobs'
      AND policyname = 'hostaway_history_sync_jobs_insert_owner_admin'
  ) THEN
    CREATE POLICY "hostaway_history_sync_jobs_insert_owner_admin"
      ON hostaway_history_sync_jobs FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_members.org_id = hostaway_history_sync_jobs.org_id
            AND org_members.user_id = auth.uid()
            AND org_members.role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hostaway_history_sync_jobs'
      AND policyname = 'hostaway_history_sync_jobs_update_owner_admin'
  ) THEN
    CREATE POLICY "hostaway_history_sync_jobs_update_owner_admin"
      ON hostaway_history_sync_jobs FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_members.org_id = hostaway_history_sync_jobs.org_id
            AND org_members.user_id = auth.uid()
            AND org_members.role IN ('owner', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_members.org_id = hostaway_history_sync_jobs.org_id
            AND org_members.user_id = auth.uid()
            AND org_members.role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hostaway_history_sync_jobs'
      AND policyname = 'hostaway_history_sync_jobs_delete_owner_admin'
  ) THEN
    CREATE POLICY "hostaway_history_sync_jobs_delete_owner_admin"
      ON hostaway_history_sync_jobs FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_members.org_id = hostaway_history_sync_jobs.org_id
            AND org_members.user_id = auth.uid()
            AND org_members.role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;
