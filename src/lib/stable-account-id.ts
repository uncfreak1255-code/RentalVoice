/**
 * Stable Account ID Resolution
 *
 * Hostaway's dashboard shows an "Account ID" next to each API key, but that
 * number is actually the API key's own ID — it changes whenever the key is
 * regenerated.  The REAL, permanent account identifier comes from the
 * `/v1/users` endpoint, which returns an `accountId` field that never changes.
 *
 * This module resolves and caches that stable ID so AI learning data survives
 * API key rotation.
 */

import { getAccessToken } from './hostaway';
import { useAppStore } from './store';
import {
  storeStableAccountIdForAccount as secureStoreStableIdForAccount,
  getStableAccountId as secureGetStableId,
} from './secure-storage';
import { autoProvisionIdentity } from './auto-provision';

const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';

/** Response shape from GET /v1/users */
interface HostawayUserResponse {
  status: string;
  result: {
    id: number;
    accountId: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    [key: string]: unknown;
  }[];
}

/**
 * Fetch the stable account ID from Hostaway's /v1/users endpoint.
 *
 * The `accountId` field on each user object is the permanent, account-level
 * identifier that remains constant regardless of API key rotation.
 *
 * @returns The stable account ID as a string, or null on failure.
 */
export async function fetchStableAccountId(
  accountId: string,
  apiKey: string
): Promise<string | null> {
  try {
    const token = await getAccessToken(accountId, apiKey);

    console.log('[StableAccountId] Fetching stable account ID from /v1/users...');

    const response = await fetch(`${HOSTAWAY_API_BASE}/users?limit=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error(
        '[StableAccountId] /v1/users failed:',
        response.status,
        await response.text().catch(() => '')
      );
      return null;
    }

    const data: HostawayUserResponse = await response.json();

    if (!data.result || data.result.length === 0) {
      console.error('[StableAccountId] /v1/users returned empty result');
      return null;
    }

    const stableId = String(data.result[0].accountId);

    if (!stableId || stableId === 'undefined' || stableId === 'null') {
      console.error('[StableAccountId] accountId field is missing or invalid');
      return null;
    }

    console.log(`[StableAccountId] Resolved stable account ID: ${stableId}`);
    return stableId;
  } catch (error) {
    console.error('[StableAccountId] Failed to fetch stable account ID:', error);
    return null;
  }
}

/**
 * Resolve the stable account ID, using cache when available.
 *
 * Check order:
 *   1. Zustand store (in-memory, fastest)
 *   2. Secure storage (persisted across restarts)
 *   3. API call to /v1/users (network, slowest — result is then cached)
 *
 * @returns The stable account ID, or null if resolution fails.
 */
export async function resolveStableAccountId(
  accountId: string,
  apiKey: string
): Promise<string | null> {
  const storeId = useAppStore.getState().settings.stableAccountId;

  // 1. Check secure storage with source-account binding (prevents stale cross-account cache)
  const storedId = await secureGetStableId(accountId);
  if (storedId) {
    // Hydrate into Zustand for fast access
    if (storeId !== storedId) {
      useAppStore.getState().setStableAccountId(storedId);
      console.log('[StableAccountId] Restored from secure storage:', storedId);
    }
    return storedId;
  }

  // If secure storage has no valid bound value, clear stale in-memory value.
  if (storeId) {
    useAppStore.getState().setStableAccountId(null);
    console.log('[StableAccountId] Cleared stale in-memory stable account cache');
  }

  // 2. Fetch from API
  const fetchedId = await fetchStableAccountId(accountId, apiKey);
  if (fetchedId) {
    // Cache in both stores
    useAppStore.getState().setStableAccountId(fetchedId);
    await secureStoreStableIdForAccount(fetchedId, accountId);

    // Fire-and-forget: provision Supabase identity for this Hostaway account
    if (accountId && fetchedId) {
      autoProvisionIdentity(accountId, fetchedId).catch(err =>
        console.warn('[StableAccountId] Auto-provision failed (non-critical):', err)
      );
    }

    return fetchedId;
  }

  console.warn('[StableAccountId] Could not resolve stable account ID — falling back to entered accountId');
  return null;
}
