/**
 * Account Data Migration
 *
 * One-time migration that moves AI learning data from old-prefix keys
 * (scoped by the unstable API key ID) to new-prefix keys (scoped by the
 * permanent stable account ID).
 *
 * Safety guarantees:
 *   - Old data is only deleted after new data is verified
 *   - Existing data at the destination is never overwritten
 *   - The migration flag prevents re-running
 *   - If any step fails, old data is preserved
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMigrationDone, setMigrationDone } from './secure-storage';

/**
 * All AI-related AsyncStorage key bases that need migration.
 * These correspond to every key used via scopedKey() across:
 *   - ai-training-service.ts (3 keys)
 *   - advanced-training.ts (11 keys)
 *   - ai-enhanced.ts (1 key)
 *   - background-fetch-service.ts (2 keys)
 */
const AI_STORAGE_KEY_BASES: string[] = [
  // ai-training-service.ts
  'ai_training_state',
  'ai_response_index',
  'ai_training_progress',

  // advanced-training.ts
  'ai_incremental_queue',
  'ai_multi_pass_state',
  'ai_property_lexicons',
  'ai_temporal_weights',
  'ai_training_quality',
  'ai_negative_examples',
  'ai_few_shot_index',
  'ai_conversation_flows',
  'ai_guest_memory',
  'ai_property_conv_knowledge',
  'ai_draft_outcomes',

  // ai-enhanced.ts
  'reply_deltas',

  // background-fetch-service.ts
  'background_sync_state',
  'background_sync_notification_id',
];

/**
 * Build a prefixed AsyncStorage key for a given account ID and base key.
 */
function buildKey(accountId: string, baseKey: string): string {
  return `acct_${accountId}_${baseKey}`;
}

/**
 * Migrate a single key from oldPrefix to newPrefix.
 *
 * @returns 'migrated' | 'skipped' | 'no_source'
 */
async function migrateSingleKey(
  baseKey: string,
  oldAccountId: string,
  newAccountId: string
): Promise<'migrated' | 'skipped' | 'no_source'> {
  const oldKey = buildKey(oldAccountId, baseKey);
  const newKey = buildKey(newAccountId, baseKey);

  // Read source data
  const sourceData = await AsyncStorage.getItem(oldKey);
  if (sourceData === null) {
    return 'no_source';
  }

  // Check if destination already has data (don't overwrite)
  const existingData = await AsyncStorage.getItem(newKey);
  if (existingData !== null) {
    console.log(`[Migration] Skipping "${baseKey}" — destination already has data`);
    return 'skipped';
  }

  // Write to new key
  await AsyncStorage.setItem(newKey, sourceData);

  // Verify the write by reading back
  const verifyData = await AsyncStorage.getItem(newKey);
  if (verifyData !== sourceData) {
    console.error(`[Migration] Verification FAILED for "${baseKey}" — keeping old data`);
    // Remove the potentially corrupt new key
    await AsyncStorage.removeItem(newKey).catch(() => {});
    throw new Error(`Migration verification failed for key: ${baseKey}`);
  }

  return 'migrated';
}

export interface MigrationResult {
  success: boolean;
  migrated: string[];
  skipped: string[];
  noSource: string[];
  errors: string[];
}

/**
 * Migrate all AI learning data from one account prefix to another.
 *
 * This runs when a stable account ID is first resolved and differs from
 * the previously used accountId (API key ID).
 *
 * @param oldAccountId - The previous accountId (API key ID) used for scoping
 * @param newAccountId - The stable account ID from /v1/users
 * @returns Detailed migration result
 */
export async function migrateAccountData(
  oldAccountId: string,
  newAccountId: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migrated: [],
    skipped: [],
    noSource: [],
    errors: [],
  };

  // Guard: same IDs — no migration needed
  if (oldAccountId === newAccountId) {
    console.log('[Migration] Old and new account IDs are identical — no migration needed');
    result.success = true;
    return result;
  }

  // Guard: already done
  const alreadyDone = await isMigrationDone(newAccountId);
  if (alreadyDone) {
    console.log('[Migration] Migration already completed for', newAccountId);
    result.success = true;
    return result;
  }

  console.log(`[Migration] Starting data migration: acct_${oldAccountId}_* → acct_${newAccountId}_*`);
  console.log(`[Migration] Migrating ${AI_STORAGE_KEY_BASES.length} key bases...`);

  // Phase 1: Copy all keys
  for (const baseKey of AI_STORAGE_KEY_BASES) {
    try {
      const status = await migrateSingleKey(baseKey, oldAccountId, newAccountId);
      switch (status) {
        case 'migrated':
          result.migrated.push(baseKey);
          break;
        case 'skipped':
          result.skipped.push(baseKey);
          break;
        case 'no_source':
          result.noSource.push(baseKey);
          break;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Migration] Error migrating "${baseKey}":`, msg);
      result.errors.push(baseKey);
    }
  }

  // If any writes failed verification, abort — don't delete old data
  if (result.errors.length > 0) {
    console.error(`[Migration] ${result.errors.length} key(s) failed — aborting. Old data preserved.`);
    return result;
  }

  // Phase 2: Delete old keys (only for keys that were actually migrated)
  for (const baseKey of result.migrated) {
    try {
      const oldKey = buildKey(oldAccountId, baseKey);
      await AsyncStorage.removeItem(oldKey);
    } catch (error) {
      // Non-fatal — old data is just orphaned, not dangerous
      console.warn(`[Migration] Failed to clean up old key "${baseKey}":`, error);
    }
  }

  // Phase 3: Mark migration as complete
  await setMigrationDone(newAccountId);

  result.success = true;
  console.log(
    `[Migration] ✅ Complete: ${result.migrated.length} migrated, ` +
    `${result.skipped.length} skipped, ${result.noSource.length} no source`
  );

  return result;
}

/**
 * Also try to migrate data stored without any account prefix (legacy keys
 * from before scoping was introduced). These would be bare keys like
 * 'ai_training_state' without any 'acct_X_' prefix.
 */
export async function migrateLegacyUnscopedData(
  newAccountId: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migrated: [],
    skipped: [],
    noSource: [],
    errors: [],
  };

  console.log('[Migration] Checking for legacy unscoped data...');

  for (const baseKey of AI_STORAGE_KEY_BASES) {
    try {
      const newKey = buildKey(newAccountId, baseKey);

      // Check if bare (unscoped) key has data
      const sourceData = await AsyncStorage.getItem(baseKey);
      if (sourceData === null) {
        result.noSource.push(baseKey);
        continue;
      }

      // Don't overwrite existing scoped data
      const existingData = await AsyncStorage.getItem(newKey);
      if (existingData !== null) {
        result.skipped.push(baseKey);
        continue;
      }

      // Migrate
      await AsyncStorage.setItem(newKey, sourceData);

      // Verify
      const verifyData = await AsyncStorage.getItem(newKey);
      if (verifyData !== sourceData) {
        await AsyncStorage.removeItem(newKey).catch(() => {});
        result.errors.push(baseKey);
        continue;
      }

      result.migrated.push(baseKey);

      // Clean up old bare key
      await AsyncStorage.removeItem(baseKey).catch(() => {});
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[Migration] Legacy key "${baseKey}" error:`, msg);
      result.errors.push(baseKey);
    }
  }

  result.success = result.errors.length === 0;

  if (result.migrated.length > 0) {
    console.log(`[Migration] Legacy data: ${result.migrated.length} keys migrated`);
  }

  return result;
}
