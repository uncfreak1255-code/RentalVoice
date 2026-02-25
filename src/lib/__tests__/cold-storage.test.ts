/**
 * Tests for cold-storage.ts
 * Covers: saveCold debouncing, saveColdImmediate, loadCold, removeCold,
 * loadAllColdData parallel loading, and flushAllPending real flush behavior.
 */

// Mock AsyncStorage
import {
  saveCold,
  saveColdImmediate,
  loadCold,
  removeCold,
  loadAllColdData,
  flushAllPending,
} from '../cold-storage';

const mockSetItem = jest.fn().mockResolvedValue(undefined);
const mockGetItem = jest.fn().mockResolvedValue(null);
const mockRemoveItem = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: (...args: unknown[]) => mockSetItem(...args),
    getItem: (...args: unknown[]) => mockGetItem(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('saveCold', () => {
  it('should debounce saves (2s)', () => {
    saveCold('conversations', [{ id: 1 }]);
    expect(mockSetItem).not.toHaveBeenCalled();

    // Fast-forward past debounce
    jest.advanceTimersByTime(2000);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      'cold_conversations',
      JSON.stringify([{ id: 1 }])
    );
  });

  it('should cancel previous debounce on rapid calls', () => {
    saveCold('conversations', [{ id: 1 }]);
    saveCold('conversations', [{ id: 1 }, { id: 2 }]);
    saveCold('conversations', [{ id: 1 }, { id: 2 }, { id: 3 }]);

    jest.advanceTimersByTime(2000);
    // Only the last value should be saved
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      'cold_conversations',
      JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }])
    );
  });

  it('should stringify data once (fix 8A)', () => {
    const data = [{ id: 1, name: 'test' }];
    saveCold('test', data);
    jest.advanceTimersByTime(2000);

    // The setItem call should use the same serialized string (not double-stringify)
    const savedValue = mockSetItem.mock.calls[0][1];
    expect(savedValue).toBe(JSON.stringify(data));
  });
});

describe('saveColdImmediate', () => {
  it('should save immediately without debounce', async () => {
    await saveColdImmediate('conversations', [{ id: 1 }]);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      'cold_conversations',
      JSON.stringify([{ id: 1 }])
    );
  });

  it('should cancel pending debounced save', async () => {
    saveCold('conversations', [{ id: 'old' }]);
    await saveColdImmediate('conversations', [{ id: 'new' }]);

    jest.advanceTimersByTime(5000);
    // Only the immediate save should have fired
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      'cold_conversations',
      JSON.stringify([{ id: 'new' }])
    );
  });
});

describe('loadCold', () => {
  it('should return parsed data when key exists', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify([{ id: 1 }]));
    const result = await loadCold('conversations', []);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('should return fallback when key does not exist', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const result = await loadCold('conversations', []);
    expect(result).toEqual([]);
  });

  it('should return fallback on parse error', async () => {
    mockGetItem.mockResolvedValueOnce('invalid json{{{');
    const result = await loadCold('conversations', []);
    expect(result).toEqual([]);
  });
});

describe('removeCold', () => {
  it('should remove the key from AsyncStorage', async () => {
    await removeCold('conversations');
    expect(mockRemoveItem).toHaveBeenCalledWith('cold_conversations');
  });

  it('should cancel pending debounced save', async () => {
    saveCold('conversations', [{ id: 1 }]);
    await removeCold('conversations');
    jest.advanceTimersByTime(5000);
    // setItem should NOT be called — the save was canceled
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});

describe('loadAllColdData', () => {
  it('should load all 9 cold keys in parallel', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([]));
    const result = await loadAllColdData();

    expect(mockGetItem).toHaveBeenCalledTimes(9);
    expect(result).toHaveProperty('conversations');
    expect(result).toHaveProperty('learningEntries');
    expect(result).toHaveProperty('draftOutcomes');
    expect(result).toHaveProperty('calibrationEntries');
    expect(result).toHaveProperty('replyDeltas');
    expect(result).toHaveProperty('conversationFlows');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('favoriteMessages');
    expect(result).toHaveProperty('autoPilotLogs');
  });
});

describe('flushAllPending (fix 3A)', () => {
  it('should save all pending data immediately', async () => {
    saveCold('conversations', [{ id: 1 }]);
    saveCold('learningEntries', [{ id: 2 }]);
    expect(mockSetItem).not.toHaveBeenCalled();

    await flushAllPending();

    expect(mockSetItem).toHaveBeenCalledTimes(2);
    expect(mockSetItem).toHaveBeenCalledWith(
      'cold_conversations',
      JSON.stringify([{ id: 1 }])
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      'cold_learningEntries',
      JSON.stringify([{ id: 2 }])
    );
  });

  it('should not fire debounced saves after flush', async () => {
    saveCold('conversations', [{ id: 1 }]);
    await flushAllPending();
    mockSetItem.mockClear();

    // Advance past the original debounce — should NOT fire again
    jest.advanceTimersByTime(5000);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('should be a no-op when nothing is pending', async () => {
    await flushAllPending();
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});
