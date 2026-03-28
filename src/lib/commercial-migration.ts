import { APP_MODE } from './config';
import { flushAllPending, loadAllColdData } from './cold-storage';
import { useAppStore } from './store';
import type { AccountSession } from './account-session';
import {
  getLocalLearningMigrationStatus,
  importLocalLearningSnapshot,
  type LocalLearningMigrationImportRequest,
  type LocalLearningMigrationImportResponse,
  type LocalLearningMigrationStatusResponse,
} from './api-client';

const FOUNDER_MIGRATION_CONTRACT_VERSION = 'founder_account_v1';

interface BuildLocalLearningMigrationSnapshotOptions {
  snapshotId?: string;
  stableAccountId?: string | null;
  accountUserId?: string;
  accountEmail?: string;
}

export interface CommercialLearningMigrationResult {
  status: 'imported' | 'skipped';
  reason?: string;
  response?: LocalLearningMigrationImportResponse;
}

export async function buildLocalLearningMigrationSnapshot(
  options: BuildLocalLearningMigrationSnapshotOptions = {},
): Promise<LocalLearningMigrationImportRequest> {
  await flushAllPending();

  const cold = await loadAllColdData();
  const state = useAppStore.getState();
  const snapshotId = options.snapshotId || `local-${Date.now()}`;
  const stableAccountId =
    options.stableAccountId ??
    state.settings.stableAccountId ??
    state.settings.accountId ??
    undefined;

  return {
    snapshotId,
    stableAccountId,
    source: 'mobile_local_store_v1',
    hostStyleProfiles: state.hostStyleProfiles as unknown as Record<string, unknown>,
    aiLearningProgress: state.aiLearningProgress as unknown as Record<string, unknown>,
    learningEntries: (cold.learningEntries || []) as unknown as Record<string, unknown>[],
    draftOutcomes: (cold.draftOutcomes || []) as unknown as Record<string, unknown>[],
    replyDeltas: (cold.replyDeltas || []) as unknown as Record<string, unknown>[],
    calibrationEntries: (cold.calibrationEntries || []) as unknown as Record<string, unknown>[],
    conversationFlows: (cold.conversationFlows || []) as unknown as Record<string, unknown>[],
    metadata: {
      appMode: APP_MODE,
      isDemoMode: state.isDemoMode,
      generatedAt: new Date().toISOString(),
      accountUserId: options.accountUserId,
      accountEmail: options.accountEmail,
      localCounts: {
        hostStyleProfiles: Object.keys(state.hostStyleProfiles || {}).length,
        learningEntries: (cold.learningEntries || []).length,
        draftOutcomes: (cold.draftOutcomes || []).length,
        replyDeltas: (cold.replyDeltas || []).length,
        calibrationEntries: (cold.calibrationEntries || []).length,
        conversationFlows: (cold.conversationFlows || []).length,
      },
    },
  };
}

export async function buildFounderLearningMigrationSnapshot(
  founderEmail: string,
  overrideSnapshotId?: string,
): Promise<LocalLearningMigrationImportRequest> {
  const basePayload = await buildLocalLearningMigrationSnapshot({
    snapshotId: overrideSnapshotId,
    accountEmail: founderEmail,
  });
  const stableAccountId = basePayload.stableAccountId || 'unknown-account';

  return {
    ...basePayload,
    source: 'personal_local_store_to_founder_account_v1',
    metadata: {
      ...(basePayload.metadata || {}),
      migrationContractVersion: FOUNDER_MIGRATION_CONTRACT_VERSION,
      migrationIntent: 'personal_local_to_founder_account',
      migrationTargetType: 'future_founder_app_auth',
      targetFounderEmail: founderEmail,
      preservePropertyScope: true,
      idempotencyKey: `${stableAccountId}:${basePayload.snapshotId}`,
    },
  };
}

export async function migrateLocalLearningToCommercial(
  snapshotId?: string,
  options: Omit<BuildLocalLearningMigrationSnapshotOptions, 'snapshotId'> = {},
): Promise<LocalLearningMigrationImportResponse> {
  const payload = await buildLocalLearningMigrationSnapshot({
    snapshotId,
    ...options,
  });
  return importLocalLearningSnapshot(payload);
}

export async function migrateLocalLearningToFounderCommercial(
  founderEmail: string,
  snapshotId?: string,
): Promise<LocalLearningMigrationImportResponse> {
  const payload = await buildFounderLearningMigrationSnapshot(founderEmail, snapshotId);
  return importLocalLearningSnapshot(payload);
}

export async function getCommercialLearningMigrationVerification():
  Promise<LocalLearningMigrationStatusResponse> {
  return getLocalLearningMigrationStatus();
}

export async function ensureCommercialLearningMigrationForAccount(
  accountSession: Pick<AccountSession, 'user'>,
  options: Pick<BuildLocalLearningMigrationSnapshotOptions, 'snapshotId' | 'stableAccountId'> = {},
): Promise<CommercialLearningMigrationResult> {
  const status = await getCommercialLearningMigrationVerification();

  if (
    status.hasSnapshot &&
    status.latestSnapshot?.importedByUserId === accountSession.user.id
  ) {
    return {
      status: 'skipped',
      reason: 'already_imported_for_account',
    };
  }

  const response = await migrateLocalLearningToCommercial(options.snapshotId, {
    stableAccountId: options.stableAccountId,
    accountUserId: accountSession.user.id,
    accountEmail: accountSession.user.email,
  });

  return {
    status: 'imported',
    response,
  };
}
