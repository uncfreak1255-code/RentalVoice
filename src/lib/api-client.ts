/**
 * API Client for Commercial Mode
 * 
 * In commercial mode, all AI and data calls go through the Rental Voice backend.
 * In personal mode, this module is unused — the app calls providers directly.
 * 
 * This client handles:
 * - Auth token injection
 * - Base URL configuration
 * - Error handling with retry
 * - Usage tracking headers
 */

import { API_BASE_URL, isPersonal } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'rv-auth-token';
const REFRESH_TOKEN_KEY = 'rv-refresh-token';

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  ok: boolean;
}

interface ApiError {
  message: string;
  code: string;
  status: number;
}

/**
 * Get stored auth token
 */
async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Store auth tokens after login
 */
export async function setAuthTokens(token: string, refreshToken?: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  if (refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

/**
 * Clear auth tokens on logout
 */
export async function clearAuthTokens(): Promise<void> {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  if (isPersonal) return true; // Personal mode is always "authenticated"
  const token = await getAuthToken();
  return token !== null;
}

/**
 * Core API request handler
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path}`;
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      message: response.statusText,
      code: 'UNKNOWN',
      status: response.status,
    }));
    
    throw new Error(`[API] ${error.code}: ${error.message}`);
  }

  const data = await response.json() as T;
  
  return {
    data,
    status: response.status,
    ok: true,
  };
}

/**
 * API client with typed methods
 */
export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  
  post: <T>(path: string, body?: Record<string, unknown>) => 
    request<T>('POST', path, body),
  
  put: <T>(path: string, body?: Record<string, unknown>) => 
    request<T>('PUT', path, body),
  
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// ============================================================
// Commercial API Endpoints
// These are only called when isCommercial === true
// ============================================================

export interface AIGenerateRequest {
  message: string;
  conversationHistory?: { role: string; content: string }[];
  propertyId?: string | number;
  guestName?: string;
  guestLanguage?: string;
  responseLanguageMode?: string;
  hostDefaultLanguage?: string;
}

export interface AIGenerateResponse {
  draft: string;
  confidence: number;
  detectedLanguage: string;
  provider: string;
  model: string;
  tokensUsed: { input: number; output: number };
}

/**
 * Generate AI draft via server proxy (commercial mode)
 */
export async function generateAIDraftViaServer(
  req: AIGenerateRequest
): Promise<AIGenerateResponse> {
  const { data } = await apiClient.post<AIGenerateResponse>('/api/ai/generate', req as unknown as Record<string, unknown>);
  return data;
}

/**
 * Get current user's AI usage stats
 */
export async function getAIUsage(): Promise<{
  month: string;
  draftsUsed: number;
  draftsLimit: number;
  tokensUsed: number;
}> {
  const { data } = await apiClient.get('/api/ai/usage');
  return data as { month: string; draftsUsed: number; draftsLimit: number; tokensUsed: number };
}
