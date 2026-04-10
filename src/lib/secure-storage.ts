// Secure Storage for Hostaway Credentials
// Uses expo-secure-store for encrypted storage on iOS (Keychain) and Android (Keystore)
// Falls back to AsyncStorage when SecureStore is not available (Expo Go, web)

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Storage keys
const STORAGE_KEYS = {
  ACCOUNT_ID: 'hostaway_account_id',
  API_KEY: 'hostaway_api_key',
  ACCESS_TOKEN: 'hostaway_access_token',
  TOKEN_EXPIRES_AT: 'hostaway_token_expires_at',
  STABLE_ACCOUNT_ID: 'hostaway_stable_account_id',
  STABLE_ACCOUNT_SOURCE_ACCOUNT_ID: 'hostaway_stable_account_source_account_id',
  MIGRATION_DONE: 'hostaway_migration_done',
  COMMERCIAL_LEARNING_IMPORT_DONE: 'hostaway_commercial_learning_import_done',
  // Founder session keys
  FOUNDER_ACCESS_TOKEN: 'rv_founder_access_token',
  FOUNDER_REFRESH_TOKEN: 'rv_founder_refresh_token',
  FOUNDER_USER_ID: 'rv_founder_user_id',
  FOUNDER_ORG_ID: 'rv_founder_org_id',
  FOUNDER_EMAIL: 'rv_founder_email',
  FOUNDER_SESSION_VALIDATED_AT: 'rv_founder_session_validated_at',
  FOUNDER_MIGRATION_STATE: 'rv_founder_migration_state',
} as const;

export interface StoredCredentials {
  accountId: string;
  apiKey: string;
}

export interface StoredToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

// Check if SecureStore is available
let secureStoreAvailable: boolean | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }

  // SecureStore is not available on web
  if (Platform.OS === 'web') {
    secureStoreAvailable = false;
    return false;
  }

  try {
    // Try a test operation to see if SecureStore works
    await SecureStore.getItemAsync('__test_secure_store__');
    secureStoreAvailable = true;
    return true;
  } catch {
    console.log('[SecureStorage] SecureStore not available, using AsyncStorage fallback');
    secureStoreAvailable = false;
    return false;
  }
}

// Wrapper functions for storage operations
async function setItem(key: string, value: string): Promise<void> {
  const useSecure = await isSecureStoreAvailable();
  if (useSecure) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  const useSecure = await isSecureStoreAvailable();
  if (useSecure) {
    return SecureStore.getItemAsync(key);
  } else {
    return AsyncStorage.getItem(key);
  }
}

async function deleteItem(key: string): Promise<void> {
  const useSecure = await isSecureStoreAvailable();
  if (useSecure) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

async function purgeFounderSessionStorage(): Promise<void> {
  await Promise.all([
    deleteItem(STORAGE_KEYS.FOUNDER_ACCESS_TOKEN),
    deleteItem(STORAGE_KEYS.FOUNDER_REFRESH_TOKEN),
    deleteItem(STORAGE_KEYS.FOUNDER_USER_ID),
    deleteItem(STORAGE_KEYS.FOUNDER_ORG_ID),
    deleteItem(STORAGE_KEYS.FOUNDER_EMAIL),
    deleteItem(STORAGE_KEYS.FOUNDER_SESSION_VALIDATED_AT),
    deleteItem(STORAGE_KEYS.FOUNDER_MIGRATION_STATE),
  ]);
}

/**
 * Securely store Hostaway credentials
 * Uses platform-native encrypted storage (Keychain on iOS, Keystore on Android)
 * Falls back to AsyncStorage when SecureStore is not available
 */
export async function storeCredentials(
  accountId: string,
  apiKey: string
): Promise<void> {
  try {
    await Promise.all([
      setItem(STORAGE_KEYS.ACCOUNT_ID, accountId),
      setItem(STORAGE_KEYS.API_KEY, apiKey),
    ]);
    console.log('[SecureStorage] Credentials stored');
  } catch (error) {
    console.error('[SecureStorage] Failed to store credentials:', error);
    throw new Error('Failed to store credentials');
  }
}

/**
 * Retrieve stored Hostaway credentials
 * Returns null if no credentials are stored
 */
export async function getCredentials(): Promise<StoredCredentials | null> {
  try {
    const [accountId, apiKey] = await Promise.all([
      getItem(STORAGE_KEYS.ACCOUNT_ID),
      getItem(STORAGE_KEYS.API_KEY),
    ]);

    if (!accountId || !apiKey) {
      return null;
    }

    return { accountId, apiKey };
  } catch (error) {
    console.error('[SecureStorage] Failed to retrieve credentials:', error);
    return null;
  }
}

/**
 * Store the access token with its expiration time
 */
export async function storeAccessToken(
  accessToken: string,
  expiresInSeconds: number
): Promise<void> {
  try {
    // Calculate expiration time (subtract 5 minutes for safety margin)
    const expiresAt = Date.now() + (expiresInSeconds - 300) * 1000;

    await Promise.all([
      setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
      setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString()),
    ]);
    console.log('[SecureStorage] Access token stored');
  } catch (error) {
    console.error('[SecureStorage] Failed to store access token:', error);
    // Don't throw - allow the app to continue working
    // The token just won't be persisted for next session
  }
}

/**
 * Retrieve the stored access token
 * Returns null if token doesn't exist or is expired
 */
export async function getAccessToken(): Promise<StoredToken | null> {
  try {
    const [accessToken, expiresAtStr] = await Promise.all([
      getItem(STORAGE_KEYS.ACCESS_TOKEN),
      getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT),
    ]);

    if (!accessToken || !expiresAtStr) {
      return null;
    }

    const expiresAt = parseInt(expiresAtStr, 10);

    // Check if token is expired
    if (Date.now() >= expiresAt) {
      console.log('[SecureStorage] Stored token is expired');
      return null;
    }

    return { accessToken, expiresAt };
  } catch (error) {
    console.error('[SecureStorage] Failed to retrieve access token:', error);
    return null;
  }
}

/**
 * Check if we have valid (non-expired) credentials and token
 */
export async function hasValidToken(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}

/**
 * Check if we have stored credentials (regardless of token status)
 */
export async function hasStoredCredentials(): Promise<boolean> {
  const credentials = await getCredentials();
  return credentials !== null;
}

/**
 * Clear only the access token (keep credentials for re-authentication)
 */
export async function clearAccessToken(): Promise<void> {
  try {
    await Promise.all([
      deleteItem(STORAGE_KEYS.ACCESS_TOKEN),
      deleteItem(STORAGE_KEYS.TOKEN_EXPIRES_AT),
    ]);
    console.log('[SecureStorage] Access token cleared');
  } catch (error) {
    console.error('[SecureStorage] Failed to clear access token:', error);
  }
}

/**
 * Clear all stored credentials and tokens (for disconnect/logout)
 */
export async function clearAllCredentials(): Promise<void> {
  try {
    await Promise.all([
      deleteItem(STORAGE_KEYS.ACCOUNT_ID),
      deleteItem(STORAGE_KEYS.API_KEY),
      deleteItem(STORAGE_KEYS.ACCESS_TOKEN),
      deleteItem(STORAGE_KEYS.TOKEN_EXPIRES_AT),
      deleteItem(STORAGE_KEYS.STABLE_ACCOUNT_ID),
      deleteItem(STORAGE_KEYS.STABLE_ACCOUNT_SOURCE_ACCOUNT_ID),
      deleteItem(STORAGE_KEYS.MIGRATION_DONE),
      deleteItem(STORAGE_KEYS.COMMERCIAL_LEARNING_IMPORT_DONE),
    ]);
    console.log('[SecureStorage] All credentials cleared');
  } catch (error) {
    console.error('[SecureStorage] Failed to clear credentials:', error);
  }
}

/**
 * Get time until token expires (in milliseconds)
 * Returns 0 if token is expired or doesn't exist
 */
export async function getTokenTimeRemaining(): Promise<number> {
  const token = await getAccessToken();
  if (!token) return 0;

  const remaining = token.expiresAt - Date.now();
  return Math.max(0, remaining);
}

/**
 * Check if token needs refresh (expires within 10 minutes)
 */
export async function tokenNeedsRefresh(): Promise<boolean> {
  const remaining = await getTokenTimeRemaining();
  const tenMinutes = 10 * 60 * 1000;
  return remaining < tenMinutes;
}

// ── Stable Account ID ──

/**
 * Store the stable (permanent) Hostaway account ID.
 * This ID is fetched from /v1/users and survives API key rotation.
 */
export async function storeStableAccountId(id: string): Promise<void> {
  try {
    await setItem(STORAGE_KEYS.STABLE_ACCOUNT_ID, id);
    console.log('[SecureStorage] Stable account ID stored');
  } catch (error) {
    console.error('[SecureStorage] Failed to store stable account ID:', error);
  }
}

/**
 * Store the stable account ID with the source Hostaway account ID that produced it.
 * Binding the cache to source account prevents stale stable IDs when users reconnect
 * with a different Hostaway account.
 */
export async function storeStableAccountIdForAccount(
  stableAccountId: string,
  sourceAccountId: string
): Promise<void> {
  try {
    await Promise.all([
      setItem(STORAGE_KEYS.STABLE_ACCOUNT_ID, stableAccountId),
      setItem(STORAGE_KEYS.STABLE_ACCOUNT_SOURCE_ACCOUNT_ID, sourceAccountId),
    ]);
    console.log('[SecureStorage] Stable account ID stored with source account binding');
  } catch (error) {
    console.error('[SecureStorage] Failed to store stable account source binding:', error);
  }
}

/**
 * Retrieve the stored stable account ID.
 * Returns null if not yet resolved.
 */
export async function getStableAccountId(sourceAccountId?: string): Promise<string | null> {
  try {
    const [stableAccountId, stableSourceAccountId] = await Promise.all([
      getItem(STORAGE_KEYS.STABLE_ACCOUNT_ID),
      getItem(STORAGE_KEYS.STABLE_ACCOUNT_SOURCE_ACCOUNT_ID),
    ]);

    if (!stableAccountId) return null;
    if (!sourceAccountId) return stableAccountId;

    // Legacy cache entry with no source binding is treated as untrusted for account-specific lookup.
    if (!stableSourceAccountId) {
      console.log('[SecureStorage] Ignoring legacy stable account cache without source binding');
      return null;
    }

    if (stableSourceAccountId !== sourceAccountId) {
      console.log('[SecureStorage] Stable account cache belongs to a different source account');
      return null;
    }

    return stableAccountId;
  } catch (error) {
    console.error('[SecureStorage] Failed to retrieve stable account ID:', error);
    return null;
  }
}

/**
 * Clear stable account cache and migration markers.
 * Use this when credentials switch to a different Hostaway account.
 */
export async function clearStableAccountCache(): Promise<void> {
  try {
    await Promise.all([
      deleteItem(STORAGE_KEYS.STABLE_ACCOUNT_ID),
      deleteItem(STORAGE_KEYS.STABLE_ACCOUNT_SOURCE_ACCOUNT_ID),
      deleteItem(STORAGE_KEYS.MIGRATION_DONE),
      deleteItem(STORAGE_KEYS.COMMERCIAL_LEARNING_IMPORT_DONE),
    ]);
    console.log('[SecureStorage] Stable account cache cleared');
  } catch (error) {
    console.error('[SecureStorage] Failed to clear stable account cache:', error);
  }
}

// ── Migration Status ──

/**
 * Check if data migration has already been completed for a given stable ID.
 */
export async function isMigrationDone(stableId: string): Promise<boolean> {
  try {
    const value = await getItem(STORAGE_KEYS.MIGRATION_DONE);
    return value === stableId;
  } catch {
    return false;
  }
}

/**
 * Mark data migration as complete for a given stable ID.
 */
export async function setMigrationDone(stableId: string): Promise<void> {
  try {
    await setItem(STORAGE_KEYS.MIGRATION_DONE, stableId);
    console.log('[SecureStorage] Migration marked complete for', stableId);
  } catch (error) {
    console.error('[SecureStorage] Failed to mark migration done:', error);
  }
}

/**
 * Check if commercial learning import has already completed for this stable account.
 */
export async function isCommercialLearningImportDone(stableId: string): Promise<boolean> {
  try {
    const value = await getItem(STORAGE_KEYS.COMMERCIAL_LEARNING_IMPORT_DONE);
    return value === stableId;
  } catch {
    return false;
  }
}

/**
 * Mark commercial learning import as complete for this stable account.
 */
export async function setCommercialLearningImportDone(stableId: string): Promise<void> {
  try {
    await setItem(STORAGE_KEYS.COMMERCIAL_LEARNING_IMPORT_DONE, stableId);
    console.log('[SecureStorage] Commercial learning import marked complete for', stableId);
  } catch (error) {
    console.error('[SecureStorage] Failed to mark commercial learning import done:', error);
  }
}

// ── Founder Session ──

export type FounderMigrationState = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface FounderSessionData {
  userId: string;
  orgId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  validatedAt: string;
  migrationState: FounderMigrationState;
}

/**
 * Persist a founder session to secure storage.
 * Tokens go to encrypted storage; metadata alongside them.
 */
export async function saveFounderSession(session: FounderSessionData): Promise<void> {
  try {
    await Promise.all([
      setItem(STORAGE_KEYS.FOUNDER_ACCESS_TOKEN, session.accessToken),
      setItem(STORAGE_KEYS.FOUNDER_REFRESH_TOKEN, session.refreshToken),
      setItem(STORAGE_KEYS.FOUNDER_USER_ID, session.userId),
      setItem(STORAGE_KEYS.FOUNDER_ORG_ID, session.orgId),
      setItem(STORAGE_KEYS.FOUNDER_EMAIL, session.email),
      setItem(STORAGE_KEYS.FOUNDER_SESSION_VALIDATED_AT, session.validatedAt),
      setItem(STORAGE_KEYS.FOUNDER_MIGRATION_STATE, session.migrationState),
    ]);
    console.log('[SecureStorage] Founder session saved');
  } catch (error) {
    console.error('[SecureStorage] Failed to save founder session:', error);
    throw new Error('Failed to save founder session');
  }
}

/**
 * Load the founder session from secure storage.
 * Returns null if any required field or validation metadata is missing.
 */
export async function loadFounderSession(): Promise<FounderSessionData | null> {
  try {
    const [accessToken, refreshToken, userId, orgId, email, validatedAt, migrationState] =
      await Promise.all([
        getItem(STORAGE_KEYS.FOUNDER_ACCESS_TOKEN),
        getItem(STORAGE_KEYS.FOUNDER_REFRESH_TOKEN),
        getItem(STORAGE_KEYS.FOUNDER_USER_ID),
        getItem(STORAGE_KEYS.FOUNDER_ORG_ID),
        getItem(STORAGE_KEYS.FOUNDER_EMAIL),
        getItem(STORAGE_KEYS.FOUNDER_SESSION_VALIDATED_AT),
        getItem(STORAGE_KEYS.FOUNDER_MIGRATION_STATE),
      ]);

    const hasFounderSessionResidue =
      !!accessToken || !!refreshToken || !!userId || !!orgId || !!email || !!validatedAt || !!migrationState;

    if (!accessToken || !refreshToken || !userId || !orgId || !email || !validatedAt) {
      if (hasFounderSessionResidue) {
        await purgeFounderSessionStorage();
      }
      return null;
    }

    return {
      accessToken,
      refreshToken,
      userId,
      orgId,
      email,
      validatedAt,
      migrationState: (migrationState as FounderMigrationState) || 'pending',
    };
  } catch (error) {
    console.error('[SecureStorage] Failed to load founder session:', error);
    return null;
  }
}

/**
 * Clear the entire founder session from secure storage.
 */
export async function clearFounderSession(): Promise<void> {
  try {
    await purgeFounderSessionStorage();
    console.log('[SecureStorage] Founder session cleared');
  } catch (error) {
    console.error('[SecureStorage] Failed to clear founder session:', error);
  }
}

/**
 * Quick check: is there a founder session present in secure storage?
 * Does not validate token expiry — just presence of required fields.
 */
export async function isFounderSessionPresent(): Promise<boolean> {
  try {
    const [accessToken, userId, email] = await Promise.all([
      getItem(STORAGE_KEYS.FOUNDER_ACCESS_TOKEN),
      getItem(STORAGE_KEYS.FOUNDER_USER_ID),
      getItem(STORAGE_KEYS.FOUNDER_EMAIL),
    ]);
    return !!(accessToken && userId && email);
  } catch (error) {
    console.error('[SecureStorage] Failed to check founder session presence:', error);
    return false;
  }
}
