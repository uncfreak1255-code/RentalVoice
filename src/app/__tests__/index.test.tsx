import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import AppEntry from '../index';

const mockReplace = jest.fn();
const mockRestoreFounderSession = jest.fn();
const mockRestoreAccountSession = jest.fn();
const mockSetCredentials = jest.fn();
const mockSetOnboarded = jest.fn();
const mockRestoreConnection = jest.fn();
const mockCanSync = jest.fn();
const mockIsLocalLearningEmpty = jest.fn();
const mockRestoreLearningFromCloud = jest.fn();
const mockSyncLearningToCloud = jest.fn();
const mockGetSyncStatus = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: (state: any) => unknown) =>
    selector({
      settings: { isOnboarded: false },
      isDemoMode: false,
      accountSession: null,
      restoreFounderSession: (...args: unknown[]) => mockRestoreFounderSession(...args),
      restoreAccountSession: (...args: unknown[]) => mockRestoreAccountSession(...args),
      setCredentials: (...args: unknown[]) => mockSetCredentials(...args),
      setOnboarded: (...args: unknown[]) => mockSetOnboarded(...args),
    }),
}));

jest.mock('@/lib/hostaway', () => ({
  restoreConnection: (...args: unknown[]) => mockRestoreConnection(...args),
}));

jest.mock('@/lib/stable-account-id', () => ({
  resolveStableAccountId: jest.fn(),
}));

jest.mock('@/lib/account-data-migration', () => ({
  migrateAccountData: jest.fn(),
  migrateLegacyUnscopedData: jest.fn(),
}));

jest.mock('@/lib/config', () => ({
  isCommercial: false,
  isContributorDemoForced: () => process.env.EXPO_PUBLIC_FORCE_DEMO === '1',
}));

jest.mock('@/lib/commercial-migration', () => ({
  ensureCommercialLearningMigrationForAccount: jest.fn(),
}));

jest.mock('@/lib/learning-sync', () => ({
  canSync: (...args: unknown[]) => mockCanSync(...args),
  isLocalLearningEmpty: (...args: unknown[]) => mockIsLocalLearningEmpty(...args),
  restoreLearningFromCloud: (...args: unknown[]) => mockRestoreLearningFromCloud(...args),
  syncLearningToCloud: (...args: unknown[]) => mockSyncLearningToCloud(...args),
  getSyncStatus: (...args: unknown[]) => mockGetSyncStatus(...args),
}));

jest.mock('@/lib/design-tokens', () => ({
  colors: {
    primary: { DEFAULT: '#14B8A6' },
    bg: { base: '#FFFFFF' },
    text: { muted: '#6B7280' },
  },
  typography: {
    fontFamily: { regular: 'System' },
  },
  spacing: { '4': 16 },
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

describe('AppEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_FORCE_DEMO;
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    } as any);
    mockRestoreFounderSession.mockResolvedValue({
      userId: 'founder-user',
      orgId: 'founder-org',
      email: 'founder@example.com',
      accessToken: 'founder-token',
      refreshToken: 'founder-refresh',
      validatedAt: '2026-04-10T12:00:00.000Z',
      migrationState: 'pending',
    });
    mockRestoreAccountSession.mockResolvedValue({
      token: 'account-token',
      refreshToken: 'account-refresh',
      user: {
        id: 'account-user',
        email: 'account@example.com',
        name: 'Account User',
        plan: 'pro',
        trialEndsAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    mockRestoreConnection.mockResolvedValue(null);
    mockCanSync.mockResolvedValue(null);
    mockIsLocalLearningEmpty.mockResolvedValue(false);
    mockRestoreLearningFromCloud.mockResolvedValue({ success: true, profileRestored: false, examplesRestored: 0 });
    mockSyncLearningToCloud.mockResolvedValue(undefined);
    mockGetSyncStatus.mockResolvedValue({ lastSyncedAt: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not restore account session after a founder restore succeeds', async () => {
    render(<AppEntry />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });

    expect(mockRestoreFounderSession).toHaveBeenCalledTimes(1);
    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
    expect(mockRestoreConnection).not.toHaveBeenCalled();
  });

  it('routes to onboarding immediately when contributor demo is forced', async () => {
    process.env.EXPO_PUBLIC_FORCE_DEMO = '1';

    render(<AppEntry />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding');
    });

    expect(mockRestoreFounderSession).not.toHaveBeenCalled();
    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
    expect(mockRestoreConnection).not.toHaveBeenCalled();
  });
});
