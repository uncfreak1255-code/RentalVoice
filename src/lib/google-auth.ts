// Google OAuth Service for Gemini API
// Provides "Sign in with Google" as an alternative to manually entering an API key
// Uses expo-auth-session for the OAuth flow and SecureStore for token persistence

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Complete any pending auth sessions (required for web redirects)
WebBrowser.maybeCompleteAuthSession();

// ─── Google OAuth Config ──────────────────────────────────

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Scopes needed for Gemini API + user display info
const SCOPES = [
  'https://www.googleapis.com/auth/generative-language',
  'email',
  'profile',
];

// ─── Storage Keys ─────────────────────────────────────────

const STORAGE_KEYS = {
  CLIENT_ID: 'google_oauth_client_id',
  ACCESS_TOKEN: 'google_oauth_access_token',
  REFRESH_TOKEN: 'google_oauth_refresh_token',
  EXPIRES_AT: 'google_oauth_expires_at',
  USER_EMAIL: 'google_oauth_user_email',
  USER_NAME: 'google_oauth_user_name',
} as const;

// ─── Storage helpers (same pattern as ai-keys.ts) ─────────

let secureStoreAvailable: boolean | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  if (Platform.OS === 'web') {
    secureStoreAvailable = false;
    return false;
  }
  try {
    await SecureStore.getItemAsync('__test_google_auth__');
    secureStoreAvailable = true;
    return true;
  } catch {
    secureStoreAvailable = false;
    return false;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

async function deleteItem(key: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

// ─── Client ID Management ─────────────────────────────────

/** Save the user's Google OAuth Client ID */
export async function setGoogleClientId(clientId: string): Promise<void> {
  await setItem(STORAGE_KEYS.CLIENT_ID, clientId);
  console.log('[GoogleAuth] Client ID saved');
}

/** Get the stored Google OAuth Client ID */
export async function getGoogleClientId(): Promise<string | null> {
  return getItem(STORAGE_KEYS.CLIENT_ID);
}

/** Delete the stored Client ID */
export async function deleteGoogleClientId(): Promise<void> {
  await deleteItem(STORAGE_KEYS.CLIENT_ID);
}

// ─── OAuth Sign-In Flow ───────────────────────────────────

export interface GoogleSignInResult {
  success: boolean;
  email?: string;
  name?: string;
  error?: string;
}

/**
 * Initiate Google OAuth sign-in flow.
 * Opens the system browser for Google consent, exchanges the auth code for tokens,
 * and stores everything securely on-device.
 */
export async function signInWithGoogle(clientId?: string): Promise<GoogleSignInResult> {
  try {
    const storedClientId = clientId || (await getGoogleClientId());
    if (!storedClientId) {
      return { success: false, error: 'No Google OAuth Client ID configured' };
    }

    // Save client ID if provided
    if (clientId) {
      await setGoogleClientId(clientId);
    }

    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'rental-voice' });
    console.log('[GoogleAuth] Redirect URI:', redirectUri);

    // Create auth request
    const request = new AuthSession.AuthRequest({
      clientId: storedClientId,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        access_type: 'offline', // Request refresh token
        prompt: 'consent',      // Force consent to get refresh token
      },
    });

    // Open consent screen
    const result = await request.promptAsync(GOOGLE_DISCOVERY);

    if (result.type !== 'success' || !result.params.code) {
      console.log('[GoogleAuth] Auth cancelled or failed:', result.type);
      return {
        success: false,
        error: result.type === 'dismiss' ? 'Sign-in cancelled' : 'Authentication failed',
      };
    }

    // Exchange auth code for tokens
    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId: storedClientId,
        code: result.params.code,
        redirectUri,
        extraParams: {
          code_verifier: request.codeVerifier || '',
        },
      },
      GOOGLE_DISCOVERY
    );

    if (!tokenResult.accessToken) {
      return { success: false, error: 'Failed to obtain access token' };
    }

    // Store tokens
    await setItem(STORAGE_KEYS.ACCESS_TOKEN, tokenResult.accessToken);

    if (tokenResult.refreshToken) {
      await setItem(STORAGE_KEYS.REFRESH_TOKEN, tokenResult.refreshToken);
    }

    const expiresAt = tokenResult.expiresIn
      ? Date.now() + tokenResult.expiresIn * 1000
      : Date.now() + 3600 * 1000; // Default 1 hour

    await setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());

    // Fetch user info for display
    const userInfo = await fetchUserInfo(tokenResult.accessToken);
    if (userInfo.email) {
      await setItem(STORAGE_KEYS.USER_EMAIL, userInfo.email);
    }
    if (userInfo.name) {
      await setItem(STORAGE_KEYS.USER_NAME, userInfo.name);
    }

    console.log('[GoogleAuth] Sign-in successful:', userInfo.email);

    return {
      success: true,
      email: userInfo.email,
      name: userInfo.name,
    };
  } catch (error) {
    console.error('[GoogleAuth] Sign-in error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown sign-in error',
    };
  }
}

// ─── Token Management ─────────────────────────────────────

/**
 * Get a valid Google access token.
 * Auto-refreshes if expired. Returns null if not signed in.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const accessToken = await getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!accessToken) return null;

    const expiresAtStr = await getItem(STORAGE_KEYS.EXPIRES_AT);
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;

    // If token expires within 5 minutes, refresh it
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() >= expiresAt - fiveMinutes) {
      console.log('[GoogleAuth] Token expired or expiring soon, refreshing...');
      const refreshed = await refreshAccessToken();
      if (refreshed) return refreshed;
      // Refresh failed — token is stale
      return null;
    }

    return accessToken;
  } catch (error) {
    console.error('[GoogleAuth] Error getting access token:', error);
    return null;
  }
}

/**
 * Refresh the access token using the stored refresh token.
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const clientId = await getGoogleClientId();

    if (!refreshToken || !clientId) {
      console.log('[GoogleAuth] No refresh token or client ID, cannot refresh');
      return null;
    }

    const tokenResult = await AuthSession.refreshAsync(
      {
        clientId,
        refreshToken,
      },
      GOOGLE_DISCOVERY
    );

    if (!tokenResult.accessToken) {
      console.error('[GoogleAuth] Refresh returned no access token');
      return null;
    }

    // Update stored tokens
    await setItem(STORAGE_KEYS.ACCESS_TOKEN, tokenResult.accessToken);

    if (tokenResult.refreshToken) {
      await setItem(STORAGE_KEYS.REFRESH_TOKEN, tokenResult.refreshToken);
    }

    const expiresAt = tokenResult.expiresIn
      ? Date.now() + tokenResult.expiresIn * 1000
      : Date.now() + 3600 * 1000;

    await setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());

    console.log('[GoogleAuth] Token refreshed successfully');
    return tokenResult.accessToken;
  } catch (error) {
    console.error('[GoogleAuth] Token refresh failed:', error);
    return null;
  }
}

// ─── User Info ────────────────────────────────────────────

interface GoogleUserInfo {
  email?: string;
  name?: string;
}

/** Fetch basic user profile from Google */
async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return {};
    const data = await res.json();
    return { email: data.email, name: data.name };
  } catch {
    return {};
  }
}

/** Get stored user info (email & name) without making a network call */
export async function getGoogleUserInfo(): Promise<GoogleUserInfo> {
  const email = await getItem(STORAGE_KEYS.USER_EMAIL);
  const name = await getItem(STORAGE_KEYS.USER_NAME);
  return { email: email || undefined, name: name || undefined };
}

// ─── Sign-Out ─────────────────────────────────────────────

/** Sign out: clear all stored tokens and user info */
export async function signOutGoogle(): Promise<void> {
  // Attempt to revoke the token server-side
  try {
    const accessToken = await getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (accessToken) {
      await AuthSession.revokeAsync(
        { token: accessToken },
        GOOGLE_DISCOVERY
      );
    }
  } catch {
    // Revocation is best-effort
  }

  // Clear local storage
  for (const key of Object.values(STORAGE_KEYS)) {
    if (key !== STORAGE_KEYS.CLIENT_ID) {
      await deleteItem(key);
    }
  }
  console.log('[GoogleAuth] Signed out');
}

// ─── Status Checks ────────────────────────────────────────

/** Check if user is currently signed in with Google */
export async function isGoogleSignedIn(): Promise<boolean> {
  const token = await getItem(STORAGE_KEYS.ACCESS_TOKEN);
  return token !== null;
}

/** Full status for the settings UI */
export interface GoogleAuthStatus {
  signedIn: boolean;
  email?: string;
  name?: string;
  hasClientId: boolean;
  tokenExpiresAt?: number;
}

export async function getGoogleAuthStatus(): Promise<GoogleAuthStatus> {
  const signedIn = await isGoogleSignedIn();
  const clientId = await getGoogleClientId();
  const email = (await getItem(STORAGE_KEYS.USER_EMAIL)) || undefined;
  const name = (await getItem(STORAGE_KEYS.USER_NAME)) || undefined;
  const expiresStr = await getItem(STORAGE_KEYS.EXPIRES_AT);
  const tokenExpiresAt = expiresStr ? parseInt(expiresStr, 10) : undefined;

  return {
    signedIn,
    email,
    name,
    hasClientId: clientId !== null && clientId.length > 0,
    tokenExpiresAt,
  };
}
