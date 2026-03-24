/**
 * Learning Sync Service
 *
 * Syncs local learning state to Supabase via the server API.
 * Only active when a founder/commercial session with valid auth exists.
 * In personal mode without auth, learning stays local-only.
 *
 * Sync triggers:
 * - After each incremental training batch completes
 * - On app foreground (pull if local state is empty/stale)
 * - Manual trigger from settings
 *
 * Conflict resolution:
 * - Compares local lastSyncedAt vs cloud lastSyncedAt
 * - Monotonic counters (totalMessagesAnalyzed etc.) take max(local, cloud)
 * - Style profiles merge by property (cloud fills gaps, local wins on conflicts)
 * - Few-shot examples use replaceAll from whichever side is newer
 *
 * Offline queue:
 * - Failed syncs are queued to AsyncStorage
 * - Retried on next sync attempt or app foreground
 *
 * Tables synced:
 * - learning_profiles: serialized trainer state blobs
 * - few_shot_examples: individual indexed examples
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { scopedKey } from './account-scoped-storage';
import { loadFounderSession, type FounderSessionData } from './secure-storage';
import { API_BASE_URL } from './config';
import { useAppStore } from './store';
import { ensureFreshToken } from './auto-provision';

// ─── Storage keys (must match advanced-training.ts) ─────
const STORAGE_KEYS = {
  incrementalQueue: 'ai_incremental_queue',
  temporalWeights: 'ai_temporal_weights',
  trainingQuality: 'ai_training_quality',
  negativeExamples: 'ai_negative_examples',
  conversationFlows: 'ai_conversation_flows',
  guestMemory: 'ai_guest_memory',
  fewShotIndex: 'ai_few_shot_index',
  draftOutcomes: 'ai_draft_outcomes',
} as const;

const SYNC_META_KEY = 'learning_sync_meta';
const OFFLINE_QUEUE_KEY = 'learning_sync_offline_queue';

// ─── Types ──────────────────────────────────────────────

interface SyncProfilePayload {
  styleProfiles: Record<string, unknown>;
  trainingProgress: Record<string, unknown>;
  incrementalState: Record<string, unknown>;
  temporalWeights: Record<string, unknown>;
  trainingQuality: Record<string, unknown>;
  conversationFlows: Record<string, unknown>;
  guestMemory: Record<string, unknown>;
  negativeExamples: Record<string, unknown>;
  draftOutcomes: Record<string, unknown>;
  totalExamplesSynced: number;
  syncVersion: number;
}

interface FewShotExample {
  guestMessage: string;
  hostResponse: string;
  guestIntent?: string;
  propertyId?: string;
  originType: 'host_written' | 'ai_approved' | 'ai_edited';
}

export interface SyncResult {
  success: boolean;
  profileSynced: boolean;
  examplesSynced: number;
  conflict?: 'local_wins' | 'cloud_wins' | 'merged' | 'none';
  retriedFromQueue?: boolean;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  profileRestored: boolean;
  examplesRestored: number;
  error?: string;
}

interface SyncMeta {
  lastSyncedAt: string | null;
  lastSyncVersion: number;
}

interface OfflineQueueEntry {
  payload: SyncProfilePayload;
  examples: FewShotExample[];
  queuedAt: string;
}

// ─── Internal Helpers ───────────────────────────────────

let lastSyncTimestamp = 0;
const MIN_SYNC_INTERVAL_MS = 30_000; // Don't sync more than once per 30s

async function loadScopedJson(key: string): Promise<Record<string, unknown>> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(key));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(`[LearningSync] Failed to load ${key}:`, e);
  }
  return {};
}

async function saveScopedJson(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(scopedKey(key), JSON.stringify(data));
  } catch (e) {
    console.error(`[LearningSync] Failed to save ${key}:`, e);
  }
}

async function authenticatedFetch(
  session: FounderSessionData,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      ...options.headers,
    },
  });
}

// ─── Sync Metadata ──────────────────────────────────────

async function loadSyncMeta(): Promise<SyncMeta> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(SYNC_META_KEY));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { lastSyncedAt: null, lastSyncVersion: 0 };
}

async function saveSyncMeta(meta: SyncMeta): Promise<void> {
  try {
    await AsyncStorage.setItem(scopedKey(SYNC_META_KEY), JSON.stringify(meta));
  } catch (e) {
    console.error('[LearningSync] Failed to save sync meta:', e);
  }
}

// ─── Offline Queue ──────────────────────────────────────

async function loadOfflineQueue(): Promise<OfflineQueueEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(OFFLINE_QUEUE_KEY));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

async function saveOfflineQueue(entry: OfflineQueueEntry | null): Promise<void> {
  try {
    if (entry) {
      await AsyncStorage.setItem(scopedKey(OFFLINE_QUEUE_KEY), JSON.stringify(entry));
    } else {
      await AsyncStorage.removeItem(scopedKey(OFFLINE_QUEUE_KEY));
    }
  } catch (e) {
    console.error('[LearningSync] Failed to save offline queue:', e);
  }
}

// ─── Conflict Resolution ────────────────────────────────

/**
 * Merge monotonic counters: take max of local vs cloud.
 * For object blobs (style profiles, etc.): local wins on overlap, cloud fills gaps.
 */
function mergeTrainingProgress(
  local: Record<string, unknown>,
  cloud: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...cloud, ...local }; // local wins on overlap

  // For numeric counters, always take the max
  const monotonicKeys = [
    'totalMessagesAnalyzed', 'totalEditsLearned', 'totalApprovalsLearned',
    'realTimeApprovalsCount', 'realTimeEditsCount',
    'realTimeIndependentRepliesCount', 'realTimeRejectionsCount',
    'patternsIndexed',
  ];

  for (const key of monotonicKeys) {
    const localVal = typeof local[key] === 'number' ? (local[key] as number) : 0;
    const cloudVal = typeof cloud[key] === 'number' ? (cloud[key] as number) : 0;
    merged[key] = Math.max(localVal, cloudVal);
  }

  return merged;
}

function mergeStyleProfiles(
  local: Record<string, unknown>,
  cloud: Record<string, unknown>,
): Record<string, unknown> {
  // Local wins on overlap, cloud fills missing properties
  return { ...cloud, ...local };
}

// ─── Public API ─────────────────────────────────────────

/**
 * Check whether learning sync is available.
 * Returns the founder session if auth is present, null otherwise.
 */
export async function canSync(): Promise<FounderSessionData | null> {
  try {
    const session = await loadFounderSession();
    if (!session?.accessToken || !session?.orgId) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Push local learning state to the server.
 * Called after training batches complete.
 *
 * Conflict resolution:
 * 1. Fetch cloud lastSyncedAt
 * 2. Compare with local lastSyncedAt
 * 3. If cloud is newer → merge cloud counters into local before pushing
 * 4. If local is newer or equal → push local (standard path)
 * 5. On network failure → queue to offline storage for retry
 */
export async function syncLearningToCloud(): Promise<SyncResult> {
  const now = Date.now();
  if (now - lastSyncTimestamp < MIN_SYNC_INTERVAL_MS) {
    return { success: true, profileSynced: false, examplesSynced: 0, error: 'Throttled' };
  }
  // Set immediately to prevent concurrent calls from passing the throttle check
  lastSyncTimestamp = now;

  // Refresh expired tokens before attempting sync
  const tokenValid = await ensureFreshToken();
  if (!tokenValid) {
    return { success: false, profileSynced: false, examplesSynced: 0, error: 'Token refresh failed' };
  }

  const session = await canSync();
  if (!session) {
    return { success: false, profileSynced: false, examplesSynced: 0, error: 'No auth session' };
  }

  // Check for queued offline sync first
  let retriedFromQueue = false;
  const queued = await loadOfflineQueue();
  if (queued) {
    console.log(`[LearningSync] Found offline queue from ${queued.queuedAt}, retrying...`);
    retriedFromQueue = true;
    // Don't clear queue here — clear after successful sync below
  }

  try {
    // 1. Gather local learning state
    const [
      incrementalState,
      temporalWeights,
      trainingQuality,
      negativeExamples,
      conversationFlows,
      guestMemory,
      draftOutcomes,
      fewShotData,
    ] = await Promise.all([
      loadScopedJson(STORAGE_KEYS.incrementalQueue),
      loadScopedJson(STORAGE_KEYS.temporalWeights),
      loadScopedJson(STORAGE_KEYS.trainingQuality),
      loadScopedJson(STORAGE_KEYS.negativeExamples),
      loadScopedJson(STORAGE_KEYS.conversationFlows),
      loadScopedJson(STORAGE_KEYS.guestMemory),
      loadScopedJson(STORAGE_KEYS.draftOutcomes),
      loadScopedJson(STORAGE_KEYS.fewShotIndex),
    ]);

    const store = useAppStore.getState();
    let styleProfiles: Record<string, unknown> = store.hostStyleProfiles || {};
    let trainingProgress = JSON.parse(JSON.stringify(store.aiLearningProgress || {})) as Record<string, unknown>;

    // 2. Conflict resolution — check cloud state
    let conflict: SyncResult['conflict'] = 'none';
    const syncMeta = await loadSyncMeta();

    try {
      const cloudRes = await authenticatedFetch(session, '/api/learning/profile');
      if (cloudRes.ok) {
        const { profile: cloudProfile, exists } = await cloudRes.json();
        if (exists && cloudProfile?.lastSyncedAt) {
          const cloudTime = new Date(cloudProfile.lastSyncedAt).getTime();
          const localTime = syncMeta.lastSyncedAt ? new Date(syncMeta.lastSyncedAt).getTime() : 0;

          if (cloudTime > localTime) {
            // Cloud is newer — merge cloud data into local before pushing
            console.log('[LearningSync] Cloud is newer, merging...');
            conflict = 'merged';

            if (cloudProfile.trainingProgress) {
              trainingProgress = mergeTrainingProgress(trainingProgress, cloudProfile.trainingProgress);
              // Write merged progress back to Zustand
              useAppStore.setState({
                aiLearningProgress: {
                  ...store.aiLearningProgress,
                  ...trainingProgress,
                },
              });
            }
            if (cloudProfile.styleProfiles) {
              styleProfiles = mergeStyleProfiles(styleProfiles, cloudProfile.styleProfiles);
              useAppStore.setState({ hostStyleProfiles: styleProfiles as Record<string, any> });
            }
          } else {
            conflict = 'local_wins';
          }
        }
      }
    } catch (conflictErr) {
      // If conflict check fails, proceed with local-wins (safe default)
      console.warn('[LearningSync] Conflict check failed, proceeding with local:', conflictErr);
      conflict = 'local_wins';
    }

    // 3. Build and push profile
    const profilePayload: SyncProfilePayload = {
      styleProfiles,
      trainingProgress,
      incrementalState,
      temporalWeights,
      trainingQuality,
      conversationFlows,
      guestMemory,
      negativeExamples,
      draftOutcomes,
      totalExamplesSynced: Array.isArray((fewShotData as { examples?: unknown[] }).examples)
        ? (fewShotData as { examples: unknown[] }).examples.length
        : 0,
      syncVersion: syncMeta.lastSyncVersion + 1,
    };

    const profileRes = await authenticatedFetch(session, '/api/learning/profile', {
      method: 'PUT',
      body: JSON.stringify(profilePayload),
    });

    const profileSynced = profileRes.ok;
    if (!profileSynced) {
      const err = await profileRes.text().catch(() => 'Unknown');
      console.error('[LearningSync] Profile sync failed:', err);
      // Queue for retry
      await queueForOfflineRetry(profilePayload, fewShotData);
      return { success: false, profileSynced: false, examplesSynced: 0, conflict, error: err };
    }

    // 4. Push few-shot examples
    let examplesSynced = 0;
    const examples = extractFewShotExamples(fewShotData);

    if (examples.length > 0) {
      const examplesRes = await authenticatedFetch(session, '/api/learning/examples', {
        method: 'POST',
        body: JSON.stringify({ examples, replaceAll: true }),
      });

      if (examplesRes.ok) {
        const result = await examplesRes.json();
        examplesSynced = result.inserted || 0;
      } else {
        console.error('[LearningSync] Examples sync failed:', await examplesRes.text().catch(() => ''));
      }
    }

    // 5. Update sync metadata
    const syncedAt = new Date().toISOString();
    await saveSyncMeta({
      lastSyncedAt: syncedAt,
      lastSyncVersion: profilePayload.syncVersion,
    });

    // Clear offline queue now that sync succeeded
    if (retriedFromQueue) {
      await saveOfflineQueue(null);
    }
    console.log(`[LearningSync] Synced profile=${profileSynced} examples=${examplesSynced} conflict=${conflict}`);
    return { success: true, profileSynced, examplesSynced, conflict, retriedFromQueue };
  } catch (err) {
    console.error('[LearningSync] Sync error:', err);

    // Queue for offline retry on network failures
    try {
      const store = useAppStore.getState();
      const fewShotData = await loadScopedJson(STORAGE_KEYS.fewShotIndex);
      await queueForOfflineRetry(
        {
          styleProfiles: store.hostStyleProfiles || {},
          trainingProgress: JSON.parse(JSON.stringify(store.aiLearningProgress || {})),
          incrementalState: {},
          temporalWeights: {},
          trainingQuality: {},
          conversationFlows: {},
          guestMemory: {},
          negativeExamples: {},
          draftOutcomes: {},
          totalExamplesSynced: 0,
          syncVersion: 1,
        },
        fewShotData,
      );
    } catch { /* best effort */ }

    return { success: false, profileSynced: false, examplesSynced: 0, error: String(err) };
  }
}

function extractFewShotExamples(fewShotData: Record<string, unknown>): FewShotExample[] {
  const rawExamples = (fewShotData as { examples?: Array<{
    guestMessage?: string;
    hostResponse?: string;
    guestIntent?: string;
    propertyId?: string;
    originType?: string;
  }> }).examples;

  if (!Array.isArray(rawExamples) || rawExamples.length === 0) return [];

  return rawExamples
    .filter((e) => e.guestMessage && e.hostResponse)
    .slice(0, 500)
    .map((e) => ({
      guestMessage: e.guestMessage!,
      hostResponse: e.hostResponse!,
      guestIntent: e.guestIntent,
      propertyId: e.propertyId,
      originType: (e.originType as FewShotExample['originType']) || 'host_written',
    }));
}

async function queueForOfflineRetry(
  payload: SyncProfilePayload,
  fewShotData: Record<string, unknown>,
): Promise<void> {
  const examples = extractFewShotExamples(fewShotData);
  await saveOfflineQueue({
    payload,
    examples,
    queuedAt: new Date().toISOString(),
  });
  console.log('[LearningSync] Queued sync for offline retry');
}

/**
 * Pull learning state from cloud and restore locally.
 * Called on app launch when local state is empty (fresh install/reset).
 */
export async function restoreLearningFromCloud(force: boolean = false): Promise<RestoreResult> {
  if (!force) {
    const empty = await isLocalLearningEmpty();
    if (!empty) {
      return { success: true, profileRestored: false, examplesRestored: 0, error: 'Local data exists — skipped restore to avoid overwriting' };
    }
  }

  const session = await canSync();
  if (!session) {
    return { success: false, profileRestored: false, examplesRestored: 0, error: 'No auth session' };
  }

  try {
    // 1. Fetch profile
    const profileRes = await authenticatedFetch(session, '/api/learning/profile');
    if (!profileRes.ok) {
      return { success: false, profileRestored: false, examplesRestored: 0, error: 'Profile fetch failed' };
    }

    const { profile, exists } = await profileRes.json();
    if (!exists || !profile) {
      return { success: true, profileRestored: false, examplesRestored: 0 };
    }

    // 2. Write profile blobs back to AsyncStorage
    const writeOps: Promise<void>[] = [];

    const blobMap: [string, unknown][] = [
      [STORAGE_KEYS.incrementalQueue, profile.incrementalState],
      [STORAGE_KEYS.temporalWeights, profile.temporalWeights],
      [STORAGE_KEYS.trainingQuality, profile.trainingQuality],
      [STORAGE_KEYS.conversationFlows, profile.conversationFlows],
      [STORAGE_KEYS.guestMemory, profile.guestMemory],
      [STORAGE_KEYS.negativeExamples, profile.negativeExamples],
      [STORAGE_KEYS.draftOutcomes, profile.draftOutcomes],
    ];

    for (const [key, data] of blobMap) {
      if (data && typeof data === 'object' && Object.keys(data as Record<string, unknown>).length > 0) {
        writeOps.push(saveScopedJson(key, data));
      }
    }

    // Restore style profiles and training progress to Zustand
    if (profile.styleProfiles && Object.keys(profile.styleProfiles).length > 0) {
      useAppStore.setState({ hostStyleProfiles: profile.styleProfiles });
    }
    if (profile.trainingProgress && Object.keys(profile.trainingProgress).length > 0) {
      useAppStore.setState({
        aiLearningProgress: {
          ...useAppStore.getState().aiLearningProgress,
          ...profile.trainingProgress,
        },
      });
    }

    await Promise.all(writeOps);

    // Update sync meta to reflect cloud state
    if (profile.lastSyncedAt) {
      await saveSyncMeta({
        lastSyncedAt: profile.lastSyncedAt,
        lastSyncVersion: profile.syncVersion || 1,
      });
    }

    // 3. Fetch and restore few-shot examples
    let examplesRestored = 0;
    const examplesRes = await authenticatedFetch(session, '/api/learning/examples?limit=2000');

    if (examplesRes.ok) {
      const { examples } = await examplesRes.json();
      if (Array.isArray(examples) && examples.length > 0) {
        const indexData = {
          examples: examples.map((e: {
            guestMessage: string;
            hostResponse: string;
            guestIntent?: string;
            propertyId?: string;
            originType?: string;
          }) => ({
            guestMessage: e.guestMessage,
            hostResponse: e.hostResponse,
            guestIntent: e.guestIntent || 'general',
            propertyId: e.propertyId,
            originType: e.originType || 'host_written',
          })),
          lastUpdated: new Date().toISOString(),
        };

        await saveScopedJson(STORAGE_KEYS.fewShotIndex, indexData);
        examplesRestored = examples.length;
      }
    }

    console.log(`[LearningSync] Restored profile + ${examplesRestored} examples from cloud`);
    return { success: true, profileRestored: true, examplesRestored };
  } catch (err) {
    console.error('[LearningSync] Restore error:', err);
    return { success: false, profileRestored: false, examplesRestored: 0, error: String(err) };
  }
}

/**
 * Check if local learning state is empty/fresh (needs restore).
 */
export async function isLocalLearningEmpty(): Promise<boolean> {
  try {
    const fewShotRaw = await AsyncStorage.getItem(scopedKey(STORAGE_KEYS.fewShotIndex));
    if (fewShotRaw) {
      const parsed = JSON.parse(fewShotRaw);
      if (Array.isArray(parsed.examples) && parsed.examples.length > 0) {
        return false;
      }
    }

    const store = useAppStore.getState();
    if (store.aiLearningProgress && store.aiLearningProgress.totalMessagesAnalyzed > 0) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Check if there's a pending offline sync to retry.
 */
export async function hasOfflineQueue(): Promise<boolean> {
  const queued = await loadOfflineQueue();
  return queued !== null;
}

/**
 * Get sync metadata for display (e.g., last synced time).
 */
export async function getSyncStatus(): Promise<{
  lastSyncedAt: string | null;
  syncVersion: number;
  hasOfflineQueue: boolean;
}> {
  const meta = await loadSyncMeta();
  const queued = await loadOfflineQueue();
  return {
    lastSyncedAt: meta.lastSyncedAt,
    syncVersion: meta.lastSyncVersion,
    hasOfflineQueue: queued !== null,
  };
}
