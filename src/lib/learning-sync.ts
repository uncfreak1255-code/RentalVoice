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
 * Tables synced:
 * - learning_profiles: serialized trainer state blobs
 * - few_shot_examples: individual indexed examples
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { scopedKey } from './account-scoped-storage';
import { loadFounderSession, type FounderSessionData } from './secure-storage';
import { API_BASE_URL } from './config';
import { useAppStore } from './store';

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

interface SyncResult {
  success: boolean;
  profileSynced: boolean;
  examplesSynced: number;
  error?: string;
}

interface RestoreResult {
  success: boolean;
  profileRestored: boolean;
  examplesRestored: number;
  error?: string;
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
 */
export async function syncLearningToCloud(): Promise<SyncResult> {
  const now = Date.now();
  if (now - lastSyncTimestamp < MIN_SYNC_INTERVAL_MS) {
    return { success: true, profileSynced: false, examplesSynced: 0, error: 'Throttled' };
  }

  const session = await canSync();
  if (!session) {
    return { success: false, profileSynced: false, examplesSynced: 0, error: 'No auth session' };
  }

  try {
    // 1. Gather learning state from AsyncStorage
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

    // Get style profiles and training progress from Zustand
    const store = useAppStore.getState();
    const styleProfiles = store.hostStyleProfiles || {};
    const trainingProgress = JSON.parse(JSON.stringify(store.aiLearningProgress || {})) as Record<string, unknown>;

    // 2. Push profile blob
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
      syncVersion: 1,
    };

    const profileRes = await authenticatedFetch(session, '/api/learning/profile', {
      method: 'PUT',
      body: JSON.stringify(profilePayload),
    });

    const profileSynced = profileRes.ok;
    if (!profileSynced) {
      const err = await profileRes.text().catch(() => 'Unknown');
      console.error('[LearningSync] Profile sync failed:', err);
    }

    // 3. Push few-shot examples (if any)
    let examplesSynced = 0;
    const rawExamples = (fewShotData as { examples?: Array<{
      guestMessage?: string;
      hostResponse?: string;
      guestIntent?: string;
      propertyId?: string;
      originType?: string;
    }> }).examples;

    if (Array.isArray(rawExamples) && rawExamples.length > 0) {
      const examples: FewShotExample[] = rawExamples
        .filter((e) => e.guestMessage && e.hostResponse)
        .slice(0, 500) // Server max per batch
        .map((e) => ({
          guestMessage: e.guestMessage!,
          hostResponse: e.hostResponse!,
          guestIntent: e.guestIntent,
          propertyId: e.propertyId,
          originType: (e.originType as FewShotExample['originType']) || 'host_written',
        }));

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
    }

    lastSyncTimestamp = Date.now();
    console.log(`[LearningSync] Synced profile=${profileSynced} examples=${examplesSynced}`);
    return { success: true, profileSynced, examplesSynced };
  } catch (err) {
    console.error('[LearningSync] Sync error:', err);
    return { success: false, profileSynced: false, examplesSynced: 0, error: String(err) };
  }
}

/**
 * Pull learning state from cloud and restore locally.
 * Called on app launch when local state is empty (fresh install/reset).
 */
export async function restoreLearningFromCloud(): Promise<RestoreResult> {
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

    if (profile.incrementalState && Object.keys(profile.incrementalState).length > 0) {
      writeOps.push(saveScopedJson(STORAGE_KEYS.incrementalQueue, profile.incrementalState));
    }
    if (profile.temporalWeights && Object.keys(profile.temporalWeights).length > 0) {
      writeOps.push(saveScopedJson(STORAGE_KEYS.temporalWeights, profile.temporalWeights));
    }
    if (profile.trainingQuality && Object.keys(profile.trainingQuality).length > 0) {
      writeOps.push(saveScopedJson(STORAGE_KEYS.trainingQuality, profile.trainingQuality));
    }
    if (profile.conversationFlows && Object.keys(profile.conversationFlows).length > 0) {
      writeOps.push(saveScopedJson(STORAGE_KEYS.conversationFlows, profile.conversationFlows));
    }
    if (profile.guestMemory && Object.keys(profile.guestMemory).length > 0) {
      writeOps.push(saveScopedJson(STORAGE_KEYS.guestMemory, profile.guestMemory));
    }
    if (profile.negativeExamples && Object.keys(profile.negativeExamples).length > 0) {
      writeOps.push(saveScopedJson(STORAGE_KEYS.negativeExamples, profile.negativeExamples));
    }
    if (profile.draftOutcomes && Object.keys(profile.draftOutcomes).length > 0) {
      writeOps.push(saveScopedJson(STORAGE_KEYS.draftOutcomes, profile.draftOutcomes));
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

    // 3. Fetch and restore few-shot examples
    let examplesRestored = 0;
    const examplesRes = await authenticatedFetch(session, '/api/learning/examples?limit=2000');

    if (examplesRes.ok) {
      const { examples } = await examplesRes.json();
      if (Array.isArray(examples) && examples.length > 0) {
        // Write to the few-shot index format
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
