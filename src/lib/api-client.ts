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
 * Autopilot: evaluate + auto-send if confidence meets threshold
 */
export interface AutoPilotRequest extends AIGenerateRequest {
  conversationId: string;
}

export interface AutoPilotResponse {
  action: 'auto_sent' | 'routed_to_copilot' | 'upgrade_required' | 'autopilot_disabled';
  draft: string | null;
  confidence: number;
  reason: string;
  sentVia?: string | null;
  pmsError?: string | null;
  provider?: string;
  model?: string;
  tokensUsed?: { input: number; output: number };
}

export async function triggerAutoPilot(
  req: AutoPilotRequest
): Promise<AutoPilotResponse> {
  const { data } = await apiClient.post<AutoPilotResponse>('/api/ai/autopilot', req as unknown as Record<string, unknown>);
  return data;
}

/**
 * Style Learning: Submit edit feedback for AI to learn host style
 */
export interface EditFeedbackRequest {
  original: string;
  edited: string;
  category?: string;
  propertyId?: string;
}

export async function submitEditFeedback(
  req: EditFeedbackRequest
): Promise<{ success: boolean; patternsAnalyzed: number }> {
  const { data } = await apiClient.post('/api/ai/learn', req as unknown as Record<string, unknown>);
  return data as { success: boolean; patternsAnalyzed: number };
}

/**
 * Get the host's learned style profile
 */
export interface StyleProfileResponse {
  hasProfile: boolean;
  profile: Record<string, unknown> | null;
  samplesAnalyzed: number;
  updatedAt: string | null;
}

export async function getStyleProfile(
  propertyId?: string
): Promise<StyleProfileResponse> {
  const query = propertyId ? `?propertyId=${propertyId}` : '';
  const { data } = await apiClient.get(`/api/ai/style-profile${query}`);
  return data as StyleProfileResponse;
}

/**
 * Generate an AI response to a guest review
 */
export interface ReviewResponseRequest {
  review: string;
  rating: number;
  propertyId?: string;
  guestName?: string;
  platform?: string;
}

export interface ReviewResponseResult {
  response: string;
  confidence: number;
  provider: string;
  model: string;
  tokensUsed: { input: number; output: number };
}

export async function generateReviewResponse(
  req: ReviewResponseRequest
): Promise<ReviewResponseResult> {
  const { data } = await apiClient.post<ReviewResponseResult>('/api/ai/review-response', req as unknown as Record<string, unknown>);
  return data;
}

/**
 * Get current user's AI usage stats
 */
export interface UsageResponse {
  month: string;
  plan: string;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  usage: {
    draftsUsed: number;
    draftsLimit: number;
    draftsRemaining: number;
    tokensIn: number;
    tokensOut: number;
    estimatedCost: number;
  };
  limits: {
    maxProperties: number;
    maxDraftsPerMonth: number;
    managedAI: boolean;
    teamMembers: number;
    autopilot: boolean;
    aiModel: string;
    overageDraftCost: number;
    extraPropertyCost: number;
    styleLearning: string;
  };
}

export async function getAIUsage(): Promise<UsageResponse> {
  const { data } = await apiClient.get('/api/usage');
  return data as UsageResponse;
}

// ============================================================
// Auth Endpoints
// ============================================================

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface AuthResponseData {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

export async function signup(req: SignupRequest): Promise<AuthResponseData> {
  const { data } = await apiClient.post<AuthResponseData>('/api/auth/signup', req);
  await setAuthTokens(data.token, data.refreshToken);
  return data;
}

export async function login(req: LoginRequest): Promise<AuthResponseData> {
  const { data } = await apiClient.post<AuthResponseData>('/api/auth/login', req);
  await setAuthTokens(data.token, data.refreshToken);
  return data;
}

export async function getCurrentUser(): Promise<{
  user: AuthUser;
  organization: { id: string; role: string; name: string } | null;
}> {
  const { data } = await apiClient.get('/api/auth/me');
  return data as { user: AuthUser; organization: { id: string; role: string; name: string } | null };
}

export async function refreshTokens(): Promise<{ token: string; refreshToken: string }> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error('No refresh token');
  const { data } = await apiClient.post<{ token: string; refreshToken: string }>(
    '/api/auth/refresh',
    { refreshToken }
  );
  await setAuthTokens(data.token, data.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  await clearAuthTokens();
}

// ============================================================
// Billing Endpoints
// ============================================================

export interface BillingStatus {
  plan: string;
  isTrialing: boolean;
  trialDaysLeft: number;
  hasPaymentMethod: boolean;
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const { data } = await apiClient.get<BillingStatus>('/api/billing/status');
  return data;
}

export async function createCheckoutSession(plan: string): Promise<{ url: string }> {
  const { data } = await apiClient.post<{ id: string; url: string }>('/api/billing/checkout', {
    plan,
    successUrl: 'rentalvoice://billing/success',
    cancelUrl: 'rentalvoice://billing/cancel',
  });
  return { url: data.url };
}

export async function createBillingPortal(): Promise<{ url: string }> {
  const { data } = await apiClient.post<{ url: string }>('/api/billing/portal', {
    returnUrl: 'rentalvoice://settings',
  });
  return { url: data.url };
}

// ============================================================
// Hostaway Endpoints
// ============================================================

export interface HostawayStatus {
  connected: boolean;
  provider: string;
  accountId: string | null;
  lastSyncAt: string | null;
}

export async function getHostawayStatus(): Promise<HostawayStatus> {
  const { data } = await apiClient.get<HostawayStatus>('/api/hostaway');
  return data;
}

export async function connectHostaway(accountId: string, apiKey: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>('/api/hostaway', { accountId, apiKey });
  return data;
}

export async function disconnectHostaway(): Promise<void> {
  await apiClient.delete('/api/hostaway');
}

export async function syncHostaway(): Promise<{ properties: unknown[]; syncedAt: string }> {
  const { data } = await apiClient.post<{ properties: unknown[]; syncedAt: string }>('/api/hostaway/sync', {});
  return data;
}

// ============================================================
// Settings Endpoints
// ============================================================

export interface OrgSettings {
  defaultLanguage: string;
  responseLanguageMode: string;
  autopilotEnabled: boolean;
  autopilotThreshold: number;
}

export async function getSettings(): Promise<{ settings: OrgSettings; aiConfig: unknown }> {
  const { data } = await apiClient.get('/api/settings');
  return data as { settings: OrgSettings; aiConfig: unknown };
}

export async function updateSettings(updates: Partial<OrgSettings>): Promise<void> {
  await apiClient.put('/api/settings', updates as Record<string, unknown>);
}

// ============================================================
// Account Endpoints
// ============================================================

export async function updateProfile(name: string): Promise<void> {
  await apiClient.put('/api/account', { name });
}

export async function deleteAccount(): Promise<void> {
  await apiClient.delete('/api/account');
  await clearAuthTokens();
}
