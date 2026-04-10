import { useAppStore } from '../store';
import type { AccountSession } from '../account-session';
import {
  ensureCommercialLearningMigrationForAccount,
  migrateLocalLearningToVerifiedFounderCommercial,
} from '../commercial-migration';

const mockFlushAllPending = jest.fn().mockResolvedValue(undefined);
const mockLoadAllColdData = jest.fn().mockResolvedValue({
  conversations: [],
  learningEntries: [],
  draftOutcomes: [],
  calibrationEntries: [],
  replyDeltas: [],
  conversationFlows: [],
  issues: [],
  favoriteMessages: [],
  autoPilotLogs: [],
});
const mockGetLocalLearningMigrationStatus = jest.fn();
const mockImportLocalLearningSnapshot = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
    multiGet: jest.fn().mockResolvedValue([]),
    multiSet: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../config', () => ({
  APP_MODE: 'commercial',
}));

jest.mock('../cold-storage', () => ({
  flushAllPending: (...args: unknown[]) => mockFlushAllPending(...args),
  loadAllColdData: (...args: unknown[]) => mockLoadAllColdData(...args),
}));

jest.mock('../api-client', () => ({
  getLocalLearningMigrationStatus: (...args: unknown[]) => mockGetLocalLearningMigrationStatus(...args),
  importLocalLearningSnapshot: (...args: unknown[]) => mockImportLocalLearningSnapshot(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState(useAppStore.getInitialState());
});

const accountSession: AccountSession = {
  token: 'token-1',
  refreshToken: 'refresh-1',
  user: {
    id: 'user-1',
    email: 'host@example.com',
    name: 'Host User',
    plan: 'pro',
    trialEndsAt: null,
    createdAt: '2026-03-27T00:00:00.000Z',
  },
};

describe('ensureCommercialLearningMigrationForAccount', () => {
  it('uploads local learning snapshot once after account authentication', async () => {
    useAppStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        stableAccountId: 'stable-1',
      },
      hostStyleProfiles: {
        global: {
          samplesAnalyzed: 12,
          commonPhrases: ['Absolutely', 'Let me know'],
        } as any,
      },
    }));

    mockGetLocalLearningMigrationStatus.mockResolvedValue({
      hasSnapshot: false,
      latestSnapshot: null,
      serverTotals: {
        hostStyleProfiles: 0,
        editPatterns: 0,
      },
    });

    mockImportLocalLearningSnapshot.mockResolvedValue({
      snapshotId: 'snapshot-1',
      source: 'mobile_local_store_v1',
      stats: {
        importedAt: '2026-03-27T00:00:00.000Z',
        hostStyleProfilesReceived: 1,
        hostStyleProfilesUpserted: 1,
        learningEntriesReceived: 0,
        editPatternsInserted: 0,
        draftOutcomesReceived: 0,
        replyDeltasReceived: 0,
        calibrationEntriesReceived: 0,
        conversationFlowsReceived: 0,
      },
      imported: {
        hostStyleProfiles: 1,
        editPatterns: 0,
      },
    });

    const result = await ensureCommercialLearningMigrationForAccount(accountSession, {
      snapshotId: 'snapshot-1',
    });

    expect(mockImportLocalLearningSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: 'snapshot-1',
        stableAccountId: 'stable-1',
        metadata: expect.objectContaining({
          accountUserId: 'user-1',
          accountEmail: 'host@example.com',
        }),
      })
    );
    expect(result.status).toBe('imported');
    expect(result.response?.imported.hostStyleProfiles).toBeGreaterThanOrEqual(0);
  });

  it('skips re-import when the authenticated account already has a migration snapshot', async () => {
    mockGetLocalLearningMigrationStatus.mockResolvedValue({
      hasSnapshot: true,
      latestSnapshot: {
        id: 'org-1:snapshot-1',
        source: 'mobile_local_store_v1',
        stableAccountId: 'stable-1',
        importedAt: '2026-03-27T00:00:00.000Z',
        importedByUserId: 'user-1',
        stats: {},
      },
      serverTotals: {
        hostStyleProfiles: 1,
        editPatterns: 3,
      },
    });

    const result = await ensureCommercialLearningMigrationForAccount(accountSession, {
      snapshotId: 'snapshot-2',
    });

    expect(mockImportLocalLearningSnapshot).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'skipped',
      reason: 'already_imported_for_account',
    });
  });
});

describe('migrateLocalLearningToVerifiedFounderCommercial', () => {
  it('imports founder learning and verifies the imported snapshot against server status', async () => {
    mockImportLocalLearningSnapshot.mockResolvedValue({
      snapshotId: 'org-1:user-1:snapshot-1',
      source: 'personal_local_store_to_founder_account_v1',
      stats: {
        importedAt: '2026-03-27T00:00:00.000Z',
        hostStyleProfilesReceived: 1,
        hostStyleProfilesUpserted: 1,
        learningEntriesReceived: 2,
        editPatternsInserted: 2,
        draftOutcomesReceived: 3,
        replyDeltasReceived: 4,
        calibrationEntriesReceived: 5,
        conversationFlowsReceived: 6,
      },
      imported: {
        hostStyleProfiles: 1,
        editPatterns: 2,
      },
    });
    mockGetLocalLearningMigrationStatus.mockResolvedValue({
      hasSnapshot: true,
      latestSnapshot: {
        id: 'org-1:user-1:snapshot-1',
        source: 'personal_local_store_to_founder_account_v1',
        stableAccountId: 'stable-1',
        importedByUserId: 'founder-user-1',
        importedAt: '2026-03-27T00:00:00.000Z',
        stats: {
          hostStyleProfilesUpserted: 1,
          editPatternsInserted: 2,
        },
      },
      serverTotals: {
        hostStyleProfiles: 11,
        editPatterns: 22,
      },
    });

    const result = await migrateLocalLearningToVerifiedFounderCommercial({
      founderEmail: 'sawyerbeck25@gmail.com',
      founderUserId: 'founder-user-1',
      snapshotId: 'snapshot-1',
    });

    expect(mockImportLocalLearningSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: 'snapshot-1',
        source: 'personal_local_store_to_founder_account_v1',
        metadata: expect.objectContaining({
          targetFounderEmail: 'sawyerbeck25@gmail.com',
        }),
      }),
    );
    expect(mockGetLocalLearningMigrationStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'verified',
      importResponse: expect.objectContaining({
        snapshotId: 'org-1:user-1:snapshot-1',
      }),
      verification: expect.objectContaining({
        latestSnapshot: expect.objectContaining({
          id: 'org-1:user-1:snapshot-1',
          importedByUserId: 'founder-user-1',
        }),
      }),
    });
  });

  it('fails verification when the server does not report the imported founder snapshot', async () => {
    mockImportLocalLearningSnapshot.mockResolvedValue({
      snapshotId: 'org-1:user-1:snapshot-1',
      source: 'personal_local_store_to_founder_account_v1',
      stats: {
        importedAt: '2026-03-27T00:00:00.000Z',
        hostStyleProfilesReceived: 0,
        hostStyleProfilesUpserted: 0,
        learningEntriesReceived: 0,
        editPatternsInserted: 0,
        draftOutcomesReceived: 0,
        replyDeltasReceived: 0,
        calibrationEntriesReceived: 0,
        conversationFlowsReceived: 0,
      },
      imported: {
        hostStyleProfiles: 0,
        editPatterns: 0,
      },
    });
    mockGetLocalLearningMigrationStatus.mockResolvedValue({
      hasSnapshot: true,
      latestSnapshot: {
        id: 'org-1:user-1:different-snapshot',
        source: 'personal_local_store_to_founder_account_v1',
        stableAccountId: 'stable-1',
        importedByUserId: 'founder-user-1',
        importedAt: '2026-03-27T00:00:00.000Z',
        stats: {},
      },
      serverTotals: {
        hostStyleProfiles: 0,
        editPatterns: 0,
      },
    });

    await expect(
      migrateLocalLearningToVerifiedFounderCommercial({
        founderEmail: 'sawyerbeck25@gmail.com',
        founderUserId: 'founder-user-1',
        snapshotId: 'snapshot-1',
      }),
    ).rejects.toThrow('Founder migration verification failed');
  });
});
