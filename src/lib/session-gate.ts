/**
 * Session Gate — Boot-time routing logic
 *
 * Determines the app entry destination based on session state.
 * Priority order:
 *   1. Founder session (durable identity) -> tabs with founder context
 *   2. Personal-mode Hostaway restore -> tabs with personal context
 *   3. Onboarding fallback
 *
 * This module does NOT perform side effects (no token refresh, no API calls).
 * It reads from the Zustand store and secure storage to make a routing decision.
 */

import { useAppStore } from './store';
import { isFounderSessionPresent } from './secure-storage';

export type AppEntryDestination =
  | { route: '/(tabs)'; context: 'founder' }
  | { route: '/(tabs)'; context: 'personal' }
  | { route: '/onboarding'; context: 'none' };

/**
 * Determine where the app should route on boot.
 *
 * Checks founder session first (in-memory store, then secure storage fallback),
 * then falls through to personal-mode Hostaway onboarded state,
 * then to onboarding.
 */
export async function getAppEntryDestination(): Promise<AppEntryDestination> {
  const state = useAppStore.getState();

  // ── 1. Founder session (already in memory) ──
  if (state.founderSession) {
    console.log('[SessionGate] Founder session active in store for', state.founderSession.email);
    return { route: '/(tabs)', context: 'founder' };
  }

  // ── 2. Founder session (persisted in secure storage but not yet restored) ──
  try {
    const founderPresent = await isFounderSessionPresent();
    if (founderPresent) {
      console.log('[SessionGate] Founder session found in secure storage, will restore');
      return { route: '/(tabs)', context: 'founder' };
    }
  } catch (error) {
    console.error('[SessionGate] Error checking founder session presence:', error);
    // Fall through to personal mode check
  }

  // ── 3. Personal-mode Hostaway (already onboarded) ──
  if (state.settings.isOnboarded) {
    console.log('[SessionGate] Personal mode onboarded, routing to tabs');
    return { route: '/(tabs)', context: 'personal' };
  }

  // ── 4. Onboarding fallback ──
  console.log('[SessionGate] No session found, routing to onboarding');
  return { route: '/onboarding', context: 'none' };
}
