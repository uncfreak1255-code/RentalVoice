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
const FOUNDER_MIGRATION_SOURCE = 'personal_local_store_to_founder_account_v1';

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

export interface VerifiedFounderMigrationParams {
  founderEmail: string;
  founderUserId: string;
  snapshotId?: string;
}

export interface VerifiedFounderMigrationResult {
  status: 'verified';
  importResponse: LocalLearningMigrationImportResponse;
  verification: LocalLearningMigrationStatusResponse;
}

function readNumericStat(stats: Record<string, unknown>, key: string): number {
  const value = stats[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function buildImportResponseFromVerification(
  verification: LocalLearningMigrationStatusResponse,
): LocalLearningMigrationImportResponse {
  const snapshot = verification.latestSnapshot;
  const stats = (snapshot?.stats as Record<string, unknown> | undefined) || {};
  const hostStyleProfilesUpserted = readNumericStat(stats, 'hostStyleProfilesUpserted');
  const editPatternsInserted = readNumericStat(stats, 'editPatternsInserted');

  return {
    snapshotId: snapshot?.id || 'verified-existing-snapshot',
    source: snapshot?.source || FOUNDER_MIGRATION_SOURCE,
    stats: {
      importedAt: snapshot?.importedAt || new Date().toISOString(),
      hostStyleProfilesReceived: readNumericStat(stats, 'hostStyleProfilesReceived') || hostStyleProfilesUpserted,
      hostStyleProfilesUpserted,
      learningEntriesReceived: readNumericStat(stats, 'learningEntriesReceived'),
      editPatternsInserted,
      draftOutcomesReceived: readNumericStat(stats, 'draftOutcomesReceived'),
      replyDeltasReceived: readNumericStat(stats, 'replyDeltasReceived'),
      calibrationEntriesReceived: readNumericStat(stats, 'calibrationEntriesReceived'),
      conversationFlowsReceived: readNumericStat(stats, 'conversationFlowsReceived'),
    },
    imported: {
      hostStyleProfiles: hostStyleProfilesUpserted,
      editPatterns: editPatternsInserted,
    },
  };
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
    source: FOUNDER_MIGRATION_SOURCE,
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

export async function migrateLocalLearningToVerifiedFounderCommercial({
  founderEmail,
  founderUserId,
  snapshotId,
}: VerifiedFounderMigrationParams): Promise<VerifiedFounderMigrationResult> {
  const preflightVerification = await getCommercialLearningMigrationVerification();
  const latestPreflightSnapshot = preflightVerification.latestSnapshot;

  if (
    preflightVerification.hasSnapshot &&
    latestPreflightSnapshot?.importedByUserId === founderUserId &&
    latestPreflightSnapshot.source === FOUNDER_MIGRATION_SOURCE
  ) {
    return {
      status: 'verified',
      importResponse: buildImportResponseFromVerification(preflightVerification),
      verification: preflightVerification,
    };
  }

  const importResponse = await migrateLocalLearningToFounderCommercial(founderEmail, snapshotId);
  const verification = await getCommercialLearningMigrationVerification();

  const latestSnapshotId = verification.latestSnapshot?.id;
  const latestImportedByUserId = verification.latestSnapshot?.importedByUserId;
  const latestSnapshotSource = verification.latestSnapshot?.source;
  const verified =
    verification.hasSnapshot &&
    latestSnapshotId === importResponse.snapshotId &&
    latestImportedByUserId === founderUserId &&
    latestSnapshotSource === importResponse.source;

  if (!verified) {
    throw new Error(
      `Founder migration verification failed: expected snapshot ${importResponse.snapshotId} (${importResponse.source}) for ${founderUserId}, got ${latestSnapshotId || 'none'} (${latestSnapshotSource || 'none'}) for ${latestImportedByUserId || 'none'}`,
    );
  }

  return {
    status: 'verified',
    importResponse,
    verification,
  };
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
