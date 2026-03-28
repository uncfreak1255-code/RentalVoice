const secureStoreData = new Map<string, string>();
const asyncStorageData = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStoreData.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => secureStoreData.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    secureStoreData.delete(key);
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => {
      asyncStorageData.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => asyncStorageData.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => {
      asyncStorageData.delete(key);
    }),
  },
}));

import {
  clearAccountSession,
  persistAccountSession,
  restoreAccountSession,
  type AccountSession,
} from '../account-session';

const mockSession: AccountSession = {
  token: 'token-123',
  refreshToken: 'refresh-456',
  user: {
    id: 'user-1',
    email: 'host@example.com',
    name: 'Host',
    plan: 'starter',
    trialEndsAt: null,
    createdAt: '2026-03-27T00:00:00.000Z',
  },
};

beforeEach(async () => {
  secureStoreData.clear();
  asyncStorageData.clear();
  await clearAccountSession();
});

describe('account session storage', () => {
  it('restores a stored account session', async () => {
    await persistAccountSession(mockSession);
    const restored = await restoreAccountSession();
    expect(restored?.user.email).toBe('host@example.com');
  });

  it('clears the stored account session', async () => {
    await persistAccountSession(mockSession);
    await clearAccountSession();
    await expect(restoreAccountSession()).resolves.toBeNull();
  });
});
