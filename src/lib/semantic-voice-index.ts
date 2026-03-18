/**
 * Semantic Voice Index — Client Module
 *
 * Queries and learns from the server-side semantic voice index.
 * Falls back to cache on server failure. Non-blocking writes.
 *
 * Auth: reads founderSession from Zustand store (orgId + accessToken).
 * Server infers orgId from the Bearer token — not sent in request body.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import { useAppStore } from './store';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VoiceExample {
  guestMessage: string;
  hostResponse: string;
  intent: string | null;
  originType: string;
  similarity: number;
  score: number;
}

interface CachedVoiceIndex {
  examples: VoiceExample[];
  cachedAt: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CACHE_KEY = 'semantic_voice_index_cache';
const CACHE_MAX_EXAMPLES = 500;
const CACHE_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ─── Auth Helper ─────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> | null {
  const session = useAppStore.getState().founderSession;
  if (!session?.accessToken) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.accessToken}`,
  };
}

// ─── Cache ───────────────────────────────────────────────────────────────────

export async function getCachedExamples(): Promise<VoiceExample[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed: CachedVoiceIndex = JSON.parse(raw);
    return Array.isArray(parsed.examples) ? parsed.examples : [];
  } catch (e) {
    console.warn('[SemanticVoiceIndex] Cache read failed:', e);
    return [];
  }
}

export async function updateCache(newExamples: VoiceExample[]): Promise<void> {
  try {
    // Dedup by guestMessage — keep latest occurrence
    const seenMessages = new Set<string>();
    const deduped: VoiceExample[] = [];
    for (let i = newExamples.length - 1; i >= 0; i--) {
      const ex = newExamples[i];
      if (!seenMessages.has(ex.guestMessage)) {
        seenMessages.add(ex.guestMessage);
        deduped.unshift(ex);
      }
    }

    const existing = await getCachedExamples();
    // Merge: new examples take priority, existing fill the rest up to cap
    const existingFiltered = existing.filter((e) => !seenMessages.has(e.guestMessage));
    const merged = [...deduped, ...existingFiltered].slice(0, CACHE_MAX_EXAMPLES);

    const payload: CachedVoiceIndex = {
      examples: merged,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[SemanticVoiceIndex] Cache write failed:', e);
  }
}

export async function shouldRefreshCache(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return true;
    const parsed: CachedVoiceIndex = JSON.parse(raw);
    if (!parsed.cachedAt) return true;
    return Date.now() - parsed.cachedAt > CACHE_REFRESH_INTERVAL_MS;
  } catch {
    return true;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Query the server for voice examples semantically similar to guestMessage.
 * Falls back to cache on server failure.
 */
export async function query(
  guestMessage: string,
  propertyId: string,
  limit: number = 5,
): Promise<VoiceExample[]> {
  const headers = getAuthHeaders();
  if (!headers) return [];

  try {
    const res = await fetch(`${API_BASE_URL}/api/voice/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ guestMessage, propertyId, limit }),
    });

    if (!res.ok) {
      console.warn('[SemanticVoiceIndex] Query failed, using cache:', res.status);
      return getCachedExamples();
    }

    const data = await res.json();
    const examples: VoiceExample[] = Array.isArray(data.examples) ? data.examples : [];

    if (examples.length > 0) {
      updateCache(examples).catch(() => {/* best effort */});
    }

    return examples;
  } catch (e) {
    console.warn('[SemanticVoiceIndex] Query error, falling back to cache:', e);
    return getCachedExamples();
  }
}

/**
 * Send a voice example to the server for learning.
 * Fire-and-forget — caller should .catch() errors.
 */
export async function learn(
  guestMessage: string,
  hostResponse: string,
  propertyId: string,
  originType?: string,
  intent?: string,
): Promise<void> {
  const headers = getAuthHeaders();
  if (!headers) return;

  const res = await fetch(`${API_BASE_URL}/api/voice/learn`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestMessage, hostResponse, propertyId, originType, intent }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown');
    throw new Error(`[SemanticVoiceIndex] Learn failed (${res.status}): ${err}`);
  }
}

/**
 * Format voice examples as a few-shot prompt block.
 */
export function formatAsPrompt(examples: VoiceExample[]): string {
  if (examples.length === 0) return '';

  const formatted = examples
    .map((ex) => `Guest: ${ex.guestMessage}\nHost: ${ex.hostResponse}`)
    .join('\n\n');

  return `\n\nHOST'S REAL REPLY EXAMPLES (semantically matched to this guest message — mirror this exact voice and style):
${formatted}
`;
}
