/**
 * Tests for stable-account-id.ts — stable Hostaway account ID resolution.
 */

import { fetchStableAccountId, resolveStableAccountId } from '../stable-account-id';
import { useAppStore } from '../store';

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

// Mock hostaway's getAccessToken
jest.mock('../hostaway', () => ({
  getAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
}));

// Mock secure-storage stable ID functions
const mockStoreStableId = jest.fn().mockResolvedValue(undefined);
const mockGetStableId = jest.fn().mockResolvedValue(null);

jest.mock('../secure-storage', () => ({
  ...jest.requireActual('../secure-storage'),
  storeStableAccountId: (...args: unknown[]) => mockStoreStableId(...args),
  getStableAccountId: (...args: unknown[]) => mockGetStableId(...args),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Reset before each test
beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState());
  jest.clearAllMocks();
  mockGetStableId.mockResolvedValue(null);
});

// ── fetchStableAccountId ──

describe('fetchStableAccountId', () => {
  it('should parse the accountId from /v1/users response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        result: [
          { id: 1, accountId: 42, email: 'host@example.com' },
        ],
      }),
    });

    const result = await fetchStableAccountId('79597', 'fake-key');

    expect(result).toBe('42');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/users'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock-access-token' },
      })
    );
  });

  it('should return null when the API call fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const result = await fetchStableAccountId('79597', 'fake-key');

    expect(result).toBeNull();
  });

  it('should return null when result array is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        result: [],
      }),
    });

    const result = await fetchStableAccountId('79597', 'fake-key');

    expect(result).toBeNull();
  });

  it('should return null on network error without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchStableAccountId('79597', 'fake-key');

    expect(result).toBeNull();
  });
});

// ── resolveStableAccountId ──

describe('resolveStableAccountId', () => {
  it('should return cached ID from Zustand store if available', async () => {
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, stableAccountId: '42' },
    });

    const result = await resolveStableAccountId('79597', 'fake-key');

    expect(result).toBe('42');
    // Should NOT have called fetch or secure storage
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockGetStableId).not.toHaveBeenCalled();
  });

  it('should restore from secure storage if not in Zustand', async () => {
    mockGetStableId.mockResolvedValueOnce('42');

    const result = await resolveStableAccountId('79597', 'fake-key');

    expect(result).toBe('42');
    // Should NOT have called fetch
    expect(mockFetch).not.toHaveBeenCalled();
    // Should have hydrated into Zustand
    expect(useAppStore.getState().settings.stableAccountId).toBe('42');
  });

  it('should fetch from API and cache if not in store or secure storage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        result: [{ id: 1, accountId: 42 }],
      }),
    });

    const result = await resolveStableAccountId('79597', 'fake-key');

    expect(result).toBe('42');
    // Should have cached in both stores
    expect(useAppStore.getState().settings.stableAccountId).toBe('42');
    expect(mockStoreStableId).toHaveBeenCalledWith('42');
  });

  it('should return null if all resolution methods fail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'fail',
    });

    const result = await resolveStableAccountId('79597', 'fake-key');

    expect(result).toBeNull();
  });
});
