jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    multiGet: jest.fn().mockResolvedValue([]),
    multiSet: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../secure-storage', () => ({
  ...jest.requireActual('../secure-storage'),
  loadFounderSession: jest.fn(),
  saveFounderSession: jest.fn().mockResolvedValue(undefined),
  clearFounderSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../account-session', () => ({
  persistAccountSession: jest.fn().mockResolvedValue(undefined),
  restoreAccountSession: jest.fn().mockResolvedValue(null),
  clearAccountSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../api-client', () => ({
  clearAuthTokens: jest.fn().mockResolvedValue(undefined),
  getCurrentUser: jest.fn(),
  setAuthTokens: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../auto-provision', () => ({
  ensureFreshToken: jest.fn(),
}));

const { useAppStore } = require('../store');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const SecureStore = require('expo-secure-store');
const secureStorage = require('../secure-storage');
const accountSession = require('../account-session');
const apiClient = require('../api-client');
const autoProvision = require('../auto-provision');

const mockAsyncStorageGetItem = AsyncStorage.getItem as jest.Mock;
const mockAsyncStorageSetItem = AsyncStorage.setItem as jest.Mock;
const mockAsyncStorageRemoveItem = AsyncStorage.removeItem as jest.Mock;
const mockSecureGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSecureSetItem = SecureStore.setItemAsync as jest.Mock;
const mockSecureDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
const mockLoadFounderSession = secureStorage.loadFounderSession as jest.Mock;
const mockSaveFounderSession = secureStorage.saveFounderSession as jest.Mock;
const mockClearFounderSession = secureStorage.clearFounderSession as jest.Mock;
const mockRestoreAccountSession = accountSession.restoreAccountSession as jest.Mock;
const mockPersistAccountSession = accountSession.persistAccountSession as jest.Mock;
const mockClearAccountSession = accountSession.clearAccountSession as jest.Mock;
const mockSetAuthTokens = apiClient.setAuthTokens as jest.Mock;
const mockClearAuthTokens = apiClient.clearAuthTokens as jest.Mock;
const mockGetCurrentUser = apiClient.getCurrentUser as jest.Mock;
const mockEnsureFreshToken = autoProvision.ensureFreshToken as jest.Mock;

const storedFounderSession = {
  userId: 'founder-user',
  orgId: 'founder-org',
  email: 'founder@example.com',
  accessToken: 'stored-access-token',
  refreshToken: 'stored-refresh-token',
  validatedAt: '2026-04-09T12:00:00.000Z',
  migrationState: 'pending' as const,
};

const refreshedFounderSession = {
  ...storedFounderSession,
  accessToken: 'fresh-access-token',
  refreshToken: 'fresh-refresh-token',
  validatedAt: '2026-04-10T12:00:00.000Z',
};

beforeEach(() => {
  mockAsyncStorageGetItem.mockReset().mockResolvedValue(null);
  mockAsyncStorageSetItem.mockReset().mockResolvedValue(undefined);
  mockAsyncStorageRemoveItem.mockReset().mockResolvedValue(undefined);
  mockSecureGetItem.mockReset().mockResolvedValue(null);
  mockSecureSetItem.mockReset().mockResolvedValue(undefined);
  mockSecureDeleteItem.mockReset().mockResolvedValue(undefined);
  mockLoadFounderSession.mockReset().mockResolvedValue(null);
  mockSaveFounderSession.mockReset().mockResolvedValue(undefined);
  mockClearFounderSession.mockReset().mockResolvedValue(undefined);
  mockRestoreAccountSession.mockReset().mockResolvedValue(null);
  mockPersistAccountSession.mockReset().mockResolvedValue(undefined);
  mockClearAccountSession.mockReset().mockResolvedValue(undefined);
  mockSetAuthTokens.mockReset().mockResolvedValue(undefined);
  mockClearAuthTokens.mockReset().mockResolvedValue(undefined);
  mockGetCurrentUser.mockReset().mockResolvedValue(null);
  mockEnsureFreshToken.mockReset().mockResolvedValue(false);
  useAppStore.setState(useAppStore.getInitialState());
});

describe('restoreFounderSession', () => {
  it('refreshes a stored founder session and validates it with /api/auth/me before restoring', async () => {
    mockLoadFounderSession
      .mockResolvedValueOnce(storedFounderSession)
      .mockResolvedValueOnce(refreshedFounderSession);
    mockEnsureFreshToken.mockResolvedValueOnce(true);
    mockGetCurrentUser.mockResolvedValueOnce({
      user: {
        id: 'founder-user',
        email: 'founder@example.com',
        name: 'Sawyer',
        plan: 'enterprise',
        trialEndsAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      organization: {
        id: 'founder-org',
        role: 'owner',
        name: 'Rental Voice',
      },
    });

    const restored = await useAppStore.getState().restoreFounderSession();

    expect(mockEnsureFreshToken).toHaveBeenCalledTimes(1);
    expect(mockSetAuthTokens).toHaveBeenCalledWith('fresh-access-token', 'fresh-refresh-token');
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(restored).toEqual(
      expect.objectContaining({
        userId: 'founder-user',
        orgId: 'founder-org',
        email: 'founder@example.com',
        accessToken: 'fresh-access-token',
        refreshToken: 'fresh-refresh-token',
      }),
    );
    expect(useAppStore.getState().founderSession).toEqual(restored);
    expect(useAppStore.getState().accountSession).toBeNull();
    expect(mockSaveFounderSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'founder-user',
        orgId: 'founder-org',
        email: 'founder@example.com',
        accessToken: 'fresh-access-token',
        refreshToken: 'fresh-refresh-token',
      }),
    );
  });

  it('clears stored founder auth state when token refresh fails', async () => {
    mockLoadFounderSession.mockResolvedValueOnce(storedFounderSession);
    mockEnsureFreshToken.mockResolvedValueOnce(false);

    const restored = await useAppStore.getState().restoreFounderSession();

    expect(restored).toBeNull();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockClearFounderSession).toHaveBeenCalledTimes(1);
    expect(mockClearAccountSession).toHaveBeenCalledTimes(1);
    expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().founderSession).toBeNull();
  });

  it('clears stored founder auth state when /api/auth/me does not resolve to a user and org', async () => {
    mockLoadFounderSession
      .mockResolvedValueOnce(storedFounderSession)
      .mockResolvedValueOnce(refreshedFounderSession);
    mockEnsureFreshToken.mockResolvedValueOnce(true);
    mockGetCurrentUser.mockResolvedValueOnce({
      user: {
        id: 'founder-user',
        email: 'founder@example.com',
        name: 'Sawyer',
        plan: 'enterprise',
        trialEndsAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      organization: null,
    });

    const restored = await useAppStore.getState().restoreFounderSession();

    expect(restored).toBeNull();
    expect(mockClearFounderSession).toHaveBeenCalledTimes(1);
    expect(mockClearAccountSession).toHaveBeenCalledTimes(1);
    expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().founderSession).toBeNull();
  });
});
