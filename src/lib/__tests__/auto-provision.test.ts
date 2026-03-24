/**
 * Tests for auto-provision.ts — client auto-provision and token refresh.
 */

import { autoProvisionIdentity, ensureFreshToken } from '../auto-provision';

// Mock dependencies
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

// Mock secure-storage founder session functions
const mockLoadFounderSession = jest.fn().mockResolvedValue(null);
const mockSaveFounderSession = jest.fn().mockResolvedValue(undefined);

jest.mock('../secure-storage', () => ({
  ...jest.requireActual('../secure-storage'),
  loadFounderSession: (...args: unknown[]) => mockLoadFounderSession(...args),
  saveFounderSession: (...args: unknown[]) => mockSaveFounderSession(...args),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper: create a JWT with a given exp timestamp (seconds)
function makeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({ sub: 'user-1', exp: expSeconds }),
  );
  return `${header}.${payload}.fake-signature`;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadFounderSession.mockResolvedValue(null);
});

// ── autoProvisionIdentity ──

describe('autoProvisionIdentity', () => {
  it('calls server and saves founder session on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        userId: 'u-1',
        orgId: 'org-1',
        email: 'host@example.com',
        accessToken: 'at-123',
        refreshToken: 'rt-456',
      }),
    });

    const result = await autoProvisionIdentity('79597', 'stable-42');

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/auto-provision'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          hostawayAccountId: '79597',
          stableAccountId: 'stable-42',
        }),
      }),
    );
    expect(mockSaveFounderSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        orgId: 'org-1',
        email: 'host@example.com',
        accessToken: 'at-123',
        refreshToken: 'rt-456',
        migrationState: 'pending',
      }),
    );
  });

  it('skips when stableAccountId is null', async () => {
    const result = await autoProvisionIdentity('79597', null);

    expect(result).toEqual({ success: false, error: 'stableAccountId is null' });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockSaveFounderSession).not.toHaveBeenCalled();
  });

  it('skips when session already exists', async () => {
    mockLoadFounderSession.mockResolvedValueOnce({
      userId: 'u-1',
      orgId: 'org-1',
      email: 'host@example.com',
      accessToken: 'at-existing',
      refreshToken: 'rt-existing',
      validatedAt: new Date().toISOString(),
      migrationState: 'pending',
    });

    const result = await autoProvisionIdentity('79597', 'stable-42');

    expect(result).toEqual({ success: true });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockSaveFounderSession).not.toHaveBeenCalled();
  });

  it('does not throw when server is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await autoProvisionIdentity('79597', 'stable-42');

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('Network error'),
    });
  });
});

// ── ensureFreshToken ──

describe('ensureFreshToken', () => {
  it('returns false when no session exists', async () => {
    const result = await ensureFreshToken();
    expect(result).toBe(false);
  });

  it('returns true when token is valid for >5 minutes', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
    mockLoadFounderSession.mockResolvedValueOnce({
      userId: 'u-1',
      orgId: 'org-1',
      email: 'host@example.com',
      accessToken: makeJwt(futureExp),
      refreshToken: 'rt-456',
      validatedAt: new Date().toISOString(),
      migrationState: 'pending',
    });

    const result = await ensureFreshToken();

    expect(result).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refreshes when token is near expiry and reads data.token', async () => {
    const nearExp = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
    mockLoadFounderSession.mockResolvedValueOnce({
      userId: 'u-1',
      orgId: 'org-1',
      email: 'host@example.com',
      accessToken: makeJwt(nearExp),
      refreshToken: 'rt-old',
      validatedAt: new Date().toISOString(),
      migrationState: 'pending',
    });

    const newExp = Math.floor(Date.now() / 1000) + 3600;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: makeJwt(newExp), // Server returns `token`, NOT `accessToken`
        refreshToken: 'rt-new',
      }),
    });

    const result = await ensureFreshToken();

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'rt-old' }),
      }),
    );
    // Verify it read data.token (not data.accessToken)
    expect(mockSaveFounderSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: makeJwt(newExp),
        refreshToken: 'rt-new',
      }),
    );
  });

  it('returns false when refresh fails', async () => {
    const nearExp = Math.floor(Date.now() / 1000) + 60;
    mockLoadFounderSession.mockResolvedValueOnce({
      userId: 'u-1',
      orgId: 'org-1',
      email: 'host@example.com',
      accessToken: makeJwt(nearExp),
      refreshToken: 'rt-old',
      validatedAt: new Date().toISOString(),
      migrationState: 'pending',
    });

    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await ensureFreshToken();

    expect(result).toBe(false);
  });
});
