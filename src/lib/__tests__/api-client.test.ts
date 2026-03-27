import { getFounderDiagnostics } from '../api-client';

const mockAsyncStorageGetItem = jest.fn().mockResolvedValue(null);
const mockAsyncStorageSetItem = jest.fn().mockResolvedValue(undefined);
const mockAsyncStorageRemoveItem = jest.fn().mockResolvedValue(undefined);
const mockSecureGetItem = jest.fn().mockResolvedValue(null);
const mockSecureSetItem = jest.fn().mockResolvedValue(undefined);
const mockSecureDeleteItem = jest.fn().mockResolvedValue(undefined);
const mockLoadFounderSession = jest.fn().mockResolvedValue(null);
const mockFetch = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
    setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
    removeItem: (...args: unknown[]) => mockAsyncStorageRemoveItem(...args),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockSecureGetItem(...args),
  setItemAsync: (...args: unknown[]) => mockSecureSetItem(...args),
  deleteItemAsync: (...args: unknown[]) => mockSecureDeleteItem(...args),
}));

jest.mock('../secure-storage', () => ({
  ...jest.requireActual('../secure-storage'),
  loadFounderSession: (...args: unknown[]) => mockLoadFounderSession(...args),
}));

describe('api-client founder auth fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorageGetItem.mockResolvedValue(null);
    mockSecureGetItem.mockResolvedValue(null);
    mockLoadFounderSession.mockResolvedValue(null);
    global.fetch = mockFetch;
  });

  it('uses the restored founder session token when no legacy auth token is stored', async () => {
    mockLoadFounderSession.mockResolvedValueOnce({
      userId: 'founder-user',
      orgId: 'founder-org',
      email: 'founder@example.com',
      accessToken: 'founder-access-token',
      refreshToken: 'founder-refresh-token',
      validatedAt: new Date().toISOString(),
      migrationState: 'pending',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ founderAccess: true }),
    });

    await getFounderDiagnostics();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/analytics/founder-diagnostics'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer founder-access-token',
        }),
      }),
    );
  });
});
