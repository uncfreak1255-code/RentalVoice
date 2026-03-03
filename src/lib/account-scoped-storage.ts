/**
 * Account-Scoped Storage Keys
 * 
 * All AI learning data and training state must be isolated per Hostaway account.
 * This module provides a helper that prefixes storage keys with the current
 * accountId, ensuring User B never inherits or overwrites User A's training.
 * 
 * Usage:
 *   import { scopedKey } from './account-scoped-storage';
 *   const key = scopedKey('ai_training_state');
 *   // Returns: "acct_12345_ai_training_state" (or "ai_training_state" if no account)
 */

import { useAppStore } from './store';

/**
 * Get the current Hostaway account ID from the app store.
 * Returns null if no account is connected.
 */
export function getCurrentAccountId(): string | null {
  return useAppStore.getState().settings.accountId;
}

/**
 * Create an account-scoped AsyncStorage key.
 * If an accountId is available, prefixes the key with "acct_{id}_".
 * Falls back to the raw key if no account is connected (e.g. demo mode).
 */
export function scopedKey(baseKey: string): string {
  const accountId = getCurrentAccountId();
  if (accountId) {
    return `acct_${accountId}_${baseKey}`;
  }
  return baseKey;
}

/**
 * Create an account-scoped key with a specific accountId.
 * Use when accountId is known but might not yet be in the store.
 */
export function scopedKeyForAccount(baseKey: string, accountId: string | null): string {
  if (accountId) {
    return `acct_${accountId}_${baseKey}`;
  }
  return baseKey;
}
