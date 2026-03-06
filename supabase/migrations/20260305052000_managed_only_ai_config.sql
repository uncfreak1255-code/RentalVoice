-- Phase 4: Managed-only AI configuration
-- Removes legacy BYOK runtime state while keeping schema backwards-compatible.

UPDATE ai_configs
SET
  mode = 'managed',
  encrypted_api_key = NULL,
  provider = NULL,
  model = NULL;

DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'ai_configs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%mode%'
  LOOP
    EXECUTE format('ALTER TABLE ai_configs DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_configs_mode_check'
      AND conrelid = 'ai_configs'::regclass
  ) THEN
    ALTER TABLE ai_configs
      ADD CONSTRAINT ai_configs_mode_check
      CHECK (mode IN ('managed'));
  END IF;
END $$;
