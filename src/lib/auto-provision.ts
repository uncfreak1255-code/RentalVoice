/**
 * Auto-Provision Identity
 *
 * Silently provisions a Supabase identity for the current Hostaway account
 * by calling the server's auto-provision endpoint. Manages JWT token refresh
 * to keep the founder session alive.
 *
 * Fire-and-forget — never blocks the app, never throws.
 */

import { API_BASE_URL } from './config';
import {
  loadFounderSession,
  saveFounderSession,
  type FounderSessionData,
} from './secure-storage';

/**
 * Provision a Supabase identity for the given Hostaway account.
 *
 * - Skips if stableAccountId is null.
 * - Skips if a founder session already exists locally.
 * - On success, persists the founder session with migrationState: 'pending'.
 * - Never throws — all errors are caught and logged.
 */
export async function autoProvisionIdentity(
  hostawayAccountId: string,
  stableAccountId: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!stableAccountId) {
      console.warn('[AutoProvision] stableAccountId is null — skipping');
      return { success: false, error: 'stableAccountId is null' };
    }

    const existingSession = await loadFounderSession();
    if (existingSession) {
      console.log('[AutoProvision] Founder session already exists — skipping');
      return { success: true };
    }

    console.log('[AutoProvision] Provisioning identity for account', hostawayAccountId);

    const response = await fetch(`${API_BASE_URL}/api/auth/auto-provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostawayAccountId, stableAccountId }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[AutoProvision] Server returned', response.status, text);
      return { success: false, error: `Server returned ${response.status}` };
    }

    const data = await response.json();

    const session: FounderSessionData = {
      userId: data.userId,
      orgId: data.orgId,
      email: data.email,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      validatedAt: new Date().toISOString(),
      migrationState: 'pending',
    };

    await saveFounderSession(session);
    console.log('[AutoProvision] Identity provisioned and session saved');

    return { success: true };
  } catch (error) {
    console.error('[AutoProvision] Failed:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Ensure the founder session's access token is fresh.
 *
 * - Returns false if no session exists.
 * - Returns true if the token is valid for >5 minutes.
 * - Attempts refresh otherwise; returns true on success, false on failure.
 * - Never throws.
 */
export async function ensureFreshToken(existingSession?: FounderSessionData | null): Promise<boolean> {
  try {
    const session = existingSession ?? await loadFounderSession();
    if (!session) {
      return false;
    }

    // Decode JWT payload to check exp
    const parts = session.accessToken.split('.');
    if (parts.length !== 3) {
      console.warn('[AutoProvision] Invalid JWT format');
      return false;
    }

    const payload = JSON.parse(atob(parts[1]));
    const expMs = payload.exp * 1000;
    const fiveMinutes = 5 * 60 * 1000;

    if (Date.now() + fiveMinutes < expMs) {
      return true;
    }

    console.log('[AutoProvision] Token near expiry — refreshing');

    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });

    if (!response.ok) {
      console.error('[AutoProvision] Token refresh failed:', response.status);
      return false;
    }

    const data = await response.json();

    // Server returns `token` (not `accessToken`) and `refreshToken`
    await saveFounderSession({
      ...session,
      accessToken: data.token,
      refreshToken: data.refreshToken,
      validatedAt: new Date().toISOString(),
    });

    console.log('[AutoProvision] Token refreshed successfully');
    return true;
  } catch (error) {
    console.error('[AutoProvision] ensureFreshToken failed:', error);
    return false;
  }
}
