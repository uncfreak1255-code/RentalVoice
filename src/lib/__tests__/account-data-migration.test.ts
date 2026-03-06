/**
 * Tests for account-data-migration.ts — zero-data-loss migration
 * from old key prefix to new stable account ID prefix.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateAccountData, migrateLegacyUnscopedData } from '../account-data-migration';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock secure-storage migration status functions
const mockIsMigrationDone = jest.fn().mockResolvedValue(false);
const mockSetMigrationDone = jest.fn().mockResolvedValue(undefined);

jest.mock('../secure-storage', () => ({
  isMigrationDone: (...args: unknown[]) => mockIsMigrationDone(...args),
  setMigrationDone: (...args: unknown[]) => mockSetMigrationDone(...args),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsMigrationDone.mockResolvedValue(false);
});

// ── migrateAccountData ──

describe('migrateAccountData', () => {
  it('should skip migration when old and new IDs are identical', async () => {
    const result = await migrateAccountData('42', '42');

    expect(result.success).toBe(true);
    expect(result.migrated).toHaveLength(0);
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it('should skip migration when already done', async () => {
    mockIsMigrationDone.mockResolvedValueOnce(true);

    const result = await migrateAccountData('79597', '42');

    expect(result.success).toBe(true);
    expect(result.migrated).toHaveLength(0);
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it('should migrate keys that have source data', async () => {
    // Simulate: only ai_training_state has data at old prefix
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === 'acct_79597_ai_training_state') {
        return '{"data":"training"}';
      }
      if (key === 'acct_42_ai_training_state') {
        // First call is to check destination (empty), second is to verify write
        return null;
      }
      return null;
    });

    // After setItem, getItem should return the new data for verification
    mockSetItem.mockImplementation(async () => {
      // After writing, update getItem to return the written data for verification
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'acct_79597_ai_training_state') return '{"data":"training"}';
        if (key === 'acct_42_ai_training_state') return '{"data":"training"}';
        return null;
      });
    });

    const result = await migrateAccountData('79597', '42');

    expect(result.success).toBe(true);
    expect(result.migrated).toContain('ai_training_state');
    expect(result.noSource.length).toBeGreaterThan(0); // Other keys have no source
    expect(mockSetMigrationDone).toHaveBeenCalledWith('42');
  });

  it('should NOT overwrite existing data at destination', async () => {
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === 'acct_79597_ai_training_state') return '{"old":"data"}';
      if (key === 'acct_42_ai_training_state') return '{"new":"already-exists"}';
      return null;
    });

    const result = await migrateAccountData('79597', '42');

    expect(result.success).toBe(true);
    expect(result.skipped).toContain('ai_training_state');
    // Should NOT have written to the destination key
    expect(mockSetItem).not.toHaveBeenCalledWith(
      'acct_42_ai_training_state',
      expect.anything()
    );
  });

  it('should be idempotent (flag prevents re-running)', async () => {
    mockIsMigrationDone.mockResolvedValueOnce(true);

    const result = await migrateAccountData('79597', '42');

    expect(result.success).toBe(true);
    expect(mockGetItem).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('should delete old keys only after successful migration', async () => {
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === 'acct_79597_ai_training_state') return '{"data":"value"}';
      if (key === 'acct_42_ai_training_state') return null;
      return null;
    });

    // Simulate verification returning the written data
    mockSetItem.mockImplementation(async () => {
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'acct_79597_ai_training_state') return '{"data":"value"}';
        if (key === 'acct_42_ai_training_state') return '{"data":"value"}';
        return null;
      });
    });

    await migrateAccountData('79597', '42');

    // Should have removed the old key
    expect(mockRemoveItem).toHaveBeenCalledWith('acct_79597_ai_training_state');
  });
});

// ── migrateLegacyUnscopedData ──

describe('migrateLegacyUnscopedData', () => {
  it('should migrate bare keys to scoped keys', async () => {
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === 'ai_training_state') return '{"legacy":"data"}';
      if (key === 'acct_42_ai_training_state') return null;
      return null;
    });

    mockSetItem.mockImplementation(async () => {
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'ai_training_state') return '{"legacy":"data"}';
        if (key === 'acct_42_ai_training_state') return '{"legacy":"data"}';
        return null;
      });
    });

    const result = await migrateLegacyUnscopedData('42');

    expect(result.success).toBe(true);
    expect(result.migrated).toContain('ai_training_state');
    expect(mockSetItem).toHaveBeenCalledWith(
      'acct_42_ai_training_state',
      '{"legacy":"data"}'
    );
  });

  it('should not overwrite existing scoped data with legacy data', async () => {
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === 'ai_training_state') return '{"legacy":"old"}';
      if (key === 'acct_42_ai_training_state') return '{"scoped":"already-here"}';
      return null;
    });

    const result = await migrateLegacyUnscopedData('42');

    expect(result.skipped).toContain('ai_training_state');
    expect(mockSetItem).not.toHaveBeenCalledWith(
      'acct_42_ai_training_state',
      expect.anything()
    );
  });
});
