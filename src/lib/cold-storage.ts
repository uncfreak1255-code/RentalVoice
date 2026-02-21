/**
 * Cold Storage Utility
 * 
 * Handles persistence of large/infrequently-accessed data arrays
 * separately from Zustand's auto-persist (partialize).
 * 
 * HOT data (settings, flags, small objects) → stays in Zustand partialize
 * COLD data (conversations, training data) → explicit save/load via this module
 * 
 * This prevents multi-MB JSON serialization on every state change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const COLD_PREFIX = 'cold_';
const DEBOUNCE_MS = 2000;

// Debounce timers per key
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

// Track latest data for each pending key (enables real flush)
const pendingData: Record<string, unknown> = {};

/**
 * Save data to cold storage (AsyncStorage) with debouncing.
 * Prevents rapid-fire serialization during active messaging.
 */
export function saveCold<T>(key: string, data: T): void {
  // Always update pending data so flushAllPending can save the latest
  pendingData[key] = data;

  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key]);
  }

  debounceTimers[key] = setTimeout(async () => {
    try {
      const json = JSON.stringify(data);
      await AsyncStorage.setItem(`${COLD_PREFIX}${key}`, json);
      console.log(`[ColdStorage] Saved ${key} (${json.length} bytes)`);
      // Clean up after successful save
      delete pendingData[key];
      delete debounceTimers[key];
    } catch (error) {
      console.error(`[ColdStorage] Failed to save ${key}:`, error);
    }
  }, DEBOUNCE_MS);
}

/**
 * Save data immediately (no debounce). Use for critical saves
 * like before app backgrounding or user-triggered saves.
 */
export async function saveColdImmediate<T>(key: string, data: T): Promise<void> {
  // Cancel any pending debounced save for this key
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key]);
    delete debounceTimers[key];
  }
  delete pendingData[key];

  try {
    await AsyncStorage.setItem(`${COLD_PREFIX}${key}`, JSON.stringify(data));
  } catch (error) {
    console.error(`[ColdStorage] Failed to immediate-save ${key}:`, error);
  }
}

/**
 * Load data from cold storage. Returns fallback if not found.
 */
export async function loadCold<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(`${COLD_PREFIX}${key}`);
    if (raw) {
      const parsed = JSON.parse(raw) as T;
      console.log(`[ColdStorage] Loaded ${key}`);
      return parsed;
    }
  } catch (error) {
    console.error(`[ColdStorage] Failed to load ${key}:`, error);
  }
  return fallback;
}

/**
 * Remove a key from cold storage.
 */
export async function removeCold(key: string): Promise<void> {
  try {
    // Cancel any pending save for this key
    if (debounceTimers[key]) {
      clearTimeout(debounceTimers[key]);
      delete debounceTimers[key];
    }
    delete pendingData[key];

    await AsyncStorage.removeItem(`${COLD_PREFIX}${key}`);
  } catch (error) {
    console.error(`[ColdStorage] Failed to remove ${key}:`, error);
  }
}

/**
 * Load all cold data for initial app hydration.
 * Called once on app mount to populate Zustand with persisted cold data.
 */
export async function loadAllColdData(): Promise<{
  conversations: unknown[];
  learningEntries: unknown[];
  draftOutcomes: unknown[];
  calibrationEntries: unknown[];
  replyDeltas: unknown[];
  conversationFlows: unknown[];
  issues: unknown[];
  favoriteMessages: unknown[];
  autoPilotLogs: unknown[];
}> {
  const start = Date.now();

  const [
    conversations,
    learningEntries,
    draftOutcomes,
    calibrationEntries,
    replyDeltas,
    conversationFlows,
    issues,
    favoriteMessages,
    autoPilotLogs,
  ] = await Promise.all([
    loadCold('conversations', []),
    loadCold('learningEntries', []),
    loadCold('draftOutcomes', []),
    loadCold('calibrationEntries', []),
    loadCold('replyDeltas', []),
    loadCold('conversationFlows', []),
    loadCold('issues', []),
    loadCold('favoriteMessages', []),
    loadCold('autoPilotLogs', []),
  ]);

  console.log(`[ColdStorage] All cold data loaded in ${Date.now() - start}ms`);

  return {
    conversations,
    learningEntries,
    draftOutcomes,
    calibrationEntries,
    replyDeltas,
    conversationFlows,
    issues,
    favoriteMessages,
    autoPilotLogs,
  };
}

/**
 * Flush all pending debounced saves immediately.
 * Call this before app backgrounding to prevent data loss.
 */
export async function flushAllPending(): Promise<void> {
  const pendingKeys = Object.keys(pendingData);
  if (pendingKeys.length === 0) return;

  console.log(`[ColdStorage] Flushing ${pendingKeys.length} pending saves...`);

  // Cancel all debounce timers
  for (const key of pendingKeys) {
    if (debounceTimers[key]) {
      clearTimeout(debounceTimers[key]);
      delete debounceTimers[key];
    }
  }

  // Save all pending data immediately in parallel
  await Promise.all(
    pendingKeys.map(async (key) => {
      try {
        const json = JSON.stringify(pendingData[key]);
        await AsyncStorage.setItem(`${COLD_PREFIX}${key}`, json);
        console.log(`[ColdStorage] Flushed ${key} (${json.length} bytes)`);
        delete pendingData[key];
      } catch (error) {
        console.error(`[ColdStorage] Failed to flush ${key}:`, error);
      }
    })
  );
}
