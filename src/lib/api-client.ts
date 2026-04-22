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
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  clearAccountSession,
  persistAccountSession,
  type AccountSession,
} from './account-session';
import { loadFounderSession } from './secure-storage';

const AUTH_TOKEN_KEY = 'rv-auth-token';
const REFRESH_TOKEN_KEY = 'rv-refresh-token';

let secureStoreAvailable: boolean | null = null;
async function isSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  if (Platform.OS === 'web') {
    secureStoreAvailable = false;
    return false;
  }
  try {
    await SecureStore.getItemAsync('__test_api_client__');
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
    const legacyToken = await getItem(AUTH_TOKEN_KEY);
    if (legacyToken) {
      return legacyToken;
    }

    const founderSession = await loadFounderSession();
    return founderSession?.accessToken || null;
  } catch {
    return null;
  }
}

// Dedupe concurrent auto-provision attempts triggered by parallel AI calls on
// cold start. The first caller's promise is awaited by everyone else.
let inFlightProvision: Promise<void> | null = null;

async function tryAutoProvisionFromStore(): Promise<void> {
  if (inFlightProvision) return inFlightProvision;
  inFlightProvision = (async () => {
    try {
      const [{ useAppStore }, { autoProvisionIdentity }] = await Promise.all([
        import('./store'),
        import('./auto-provision'),
      ]);
      const { accountId, stableAccountId } = useAppStore.getState().settings;
      if (!accountId || !stableAccountId) return;
      await autoProvisionIdentity(accountId, stableAccountId);
    } catch (error) {
      console.warn('[API Client] Lazy auto-provision failed:', error);
    } finally {
      inFlightProvision = null;
    }
  })();
  return inFlightProvision;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  if (token) return { Authorization: `Bearer ${token}` };

  // No session yet. The AI proxy now rejects unauthenticated requests, so try
  // a lazy auto-provision before giving up. Safe to call repeatedly — the
  // provisioner short-circuits when a session already exists.
  await tryAutoProvisionFromStore();
  const refreshed = await getAuthToken();
  return refreshed ? { Authorization: `Bearer ${refreshed}` } : {};
}

/**
 * Store auth tokens after login
 */
export async function setAuthTokens(token: string, refreshToken?: string): Promise<void> {
  await setItem(AUTH_TOKEN_KEY, token);
  if (refreshToken) {
    await setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

/**
 * Clear auth tokens on logout
 */
export async function clearAuthTokens(): Promise<void> {
  await deleteItem(AUTH_TOKEN_KEY);
  await deleteItem(REFRESH_TOKEN_KEY);
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
  
  if (token) headers['Authorization'] = `Bearer ${token}`;

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
  usedFallback: boolean;
  tokensUsed: { input: number; output: number };
}

export interface ServerVoiceReadiness {
  state: 'untrained' | 'learning' | 'ready' | 'degraded';
  importedExamples: number;
  styleSamples: number;
  semanticReady: boolean;
  autopilotEligible: boolean;
  reason: string;
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

export async function getVoiceReadinessViaServer(
  propertyId?: string | number
): Promise<ServerVoiceReadiness> {
  const query = propertyId ? `?propertyId=${encodeURIComponent(String(propertyId))}` : '';
  const { data } = await apiClient.get<ServerVoiceReadiness>(`/api/ai/voice-readiness${query}`);
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
  usedFallback?: boolean;
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

export interface DraftOutcomeFeedbackRequest {
  outcomeType: 'approved' | 'edited' | 'rejected' | 'independent';
  propertyId?: string;
  guestIntent?: string;
  confidence?: number;
  aiDraft?: string;
  hostReply?: string;
  guestMessage?: string;
}

export async function recordDraftOutcomeViaServer(
  req: DraftOutcomeFeedbackRequest
): Promise<{ success: boolean; outcomeType: string; patternsAnalyzed: number }> {
  const { data } = await apiClient.post(
    '/api/ai/outcome',
    req as unknown as Record<string, unknown>
  );
  return data as { success: boolean; outcomeType: string; patternsAnalyzed: number };
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
  managedModel?: {
    label: string;
    provider: string;
    model: string;
    fallbackCount: number;
    maxOutputTokensPerDraft: number;
    maxEstimatedCostUsdPerDraft: number;
  };
}

export async function getAIUsage(): Promise<UsageResponse> {
  const { data } = await apiClient.get('/api/usage');
  return data as UsageResponse;
}

export interface EntitlementsResponse {
  plan: string;
  entitlements: {
    supermemoryEnabled: boolean;
    supermemoryMode: 'off' | 'full' | 'degraded';
    supermemoryTrialEndsAt: string | null;
    supermemoryWriteLimitMonthly: number;
    supermemoryReadLimitMonthly: number;
    supermemoryWriteRemaining: number;
    supermemoryReadRemaining: number;
    supermemoryRetentionDays: number;
    supermemoryTopK: number;
    supermemoryCrossProperty: boolean;
    supermemoryTeamShared: boolean;
    supermemoryAddonActive: boolean;
  };
  usage: {
    month: string;
    memoryReads: number;
    memoryWrites: number;
  };
  trial: {
    isTrialActive: boolean;
    trialEndsAt: string | null;
  };
}

export async function getCurrentEntitlements(): Promise<EntitlementsResponse> {
  const { data } = await apiClient.get<EntitlementsResponse>('/api/entitlements/current');
  return data;
}

export interface LocalLearningMigrationImportRequest {
  snapshotId?: string;
  stableAccountId?: string;
  source?: string;
  hostStyleProfiles?: Record<string, unknown>;
  aiLearningProgress?: Record<string, unknown>;
  learningEntries?: Record<string, unknown>[];
  draftOutcomes?: Record<string, unknown>[];
  replyDeltas?: Record<string, unknown>[];
  calibrationEntries?: Record<string, unknown>[];
  conversationFlows?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

export interface LocalLearningMigrationImportResponse {
  snapshotId: string;
  source: string;
  stats: {
    importedAt: string;
    hostStyleProfilesReceived: number;
    hostStyleProfilesUpserted: number;
    learningEntriesReceived: number;
    editPatternsInserted: number;
    draftOutcomesReceived: number;
    replyDeltasReceived: number;
    calibrationEntriesReceived: number;
    conversationFlowsReceived: number;
  };
  imported: {
    hostStyleProfiles: number;
    editPatterns: number;
  };
}

export interface LocalLearningMigrationStatusResponse {
  hasSnapshot: boolean;
  latestSnapshot: {
    id: string;
    source: string;
    stableAccountId: string | null;
    importedByUserId: string;
    importedAt: string;
    stats: Record<string, unknown>;
  } | null;
  serverTotals: {
    hostStyleProfiles: number;
    editPatterns: number;
  };
}

export async function importLocalLearningSnapshot(
  payload: LocalLearningMigrationImportRequest
): Promise<LocalLearningMigrationImportResponse> {
  const { data } = await apiClient.post<LocalLearningMigrationImportResponse>(
    '/api/migration/local-learning/import',
    payload as unknown as Record<string, unknown>
  );
  return data;
}

export async function getLocalLearningMigrationStatus(): Promise<LocalLearningMigrationStatusResponse> {
  const { data } = await apiClient.get<LocalLearningMigrationStatusResponse>('/api/migration/local-learning/status');
  return data;
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

export interface PasswordlessAuthResponseData extends AuthResponseData {
  founderAccess?: boolean;
}

function toAccountSession(data: AuthResponseData): AccountSession {
  return {
    token: data.token,
    refreshToken: data.refreshToken,
    user: data.user,
  };
}

export async function signup(req: SignupRequest): Promise<AuthResponseData> {
  const { data } = await apiClient.post<AuthResponseData>('/api/auth/signup', req as unknown as Record<string, unknown>);
  await setAuthTokens(data.token, data.refreshToken);
  await persistAccountSession(toAccountSession(data));
  return data;
}

export async function login(req: LoginRequest): Promise<AuthResponseData> {
  const { data } = await apiClient.post<AuthResponseData>('/api/auth/login', req as unknown as Record<string, unknown>);
  await setAuthTokens(data.token, data.refreshToken);
  await persistAccountSession(toAccountSession(data));
  return data;
}

export async function requestEmailCode(email: string, name?: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>('/api/auth/request-code', {
    email,
    ...(name ? { name } : {}),
  });
  return data;
}

export async function verifyEmailCode(email: string, code: string): Promise<PasswordlessAuthResponseData> {
  const { data } = await apiClient.post<PasswordlessAuthResponseData>('/api/auth/verify-code', {
    email,
    code,
  });
  await setAuthTokens(data.token, data.refreshToken);
  await persistAccountSession(toAccountSession(data));
  return data;
}

export async function consumeMagicLink(code: string): Promise<PasswordlessAuthResponseData> {
  const { data } = await apiClient.post<PasswordlessAuthResponseData>('/api/auth/consume-link', {
    code,
  });
  await setAuthTokens(data.token, data.refreshToken);
  await persistAccountSession(toAccountSession(data));
  return data;
}

export interface CurrentUserResponseData {
  user: AuthUser;
  organization: { id: string; role: string; name: string } | null;
  founderAccess?: boolean;
}

export async function getCurrentUser(): Promise<CurrentUserResponseData> {
  const { data } = await apiClient.get('/api/auth/me');
  return data as CurrentUserResponseData;
}

export async function refreshTokens(): Promise<{ token: string; refreshToken: string }> {
  const refreshToken = await getItem(REFRESH_TOKEN_KEY);
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
  await clearAccountSession();
}

// ============================================================
// Billing Endpoints
// ============================================================

export interface BillingStatus {
  plan: string;
  basePlan?: string;
  isTrialing: boolean;
  trialDaysLeft: number;
  hasPaymentMethod: boolean;
  founderAccess?: boolean;
  billingBypass?: boolean;
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const { data } = await apiClient.get<BillingStatus>('/api/billing/status');
  return data;
}

export async function createCheckoutSession(plan: string): Promise<{ url: string }> {
  const { data } = await apiClient.post<{ id: string; url: string }>('/api/billing/checkout', {
    plan,
    successUrl: 'rental-voice://settings/billing?checkout=success',
    cancelUrl: 'rental-voice://settings/billing?checkout=cancelled',
  });
  return { url: data.url };
}

export async function createBillingPortal(): Promise<{ url: string }> {
  const { data } = await apiClient.post<{ url: string }>('/api/billing/portal', {
    returnUrl: 'rental-voice://settings/billing?portal=returned',
  });
  return { url: data.url };
}

export async function setSupermemoryAddon(active: boolean): Promise<{ success: boolean; entitlements: Record<string, unknown> }> {
  const { data } = await apiClient.post<{ success: boolean; entitlements: Record<string, unknown> }>('/api/billing/addons/supermemory', {
    active,
  });
  return data;
}

export interface ProductEventRequest {
  eventName:
    | 'billing_screen_viewed'
    | 'billing_checkout_started'
    | 'billing_portal_opened'
    | 'billing_memory_addon_enabled'
    | 'billing_memory_addon_disabled'
    | 'billing_returned';
  category: 'billing';
  source?: string;
  properties?: Record<string, string | number | boolean | null>;
  occurredAt?: string;
}

export async function trackProductEvent(event: ProductEventRequest): Promise<void> {
  await apiClient.post('/api/analytics/events', { ...event });
}

export interface FounderDiagnosticsResponse {
  founderAccess: boolean;
  billingBypass: boolean;
  founder: {
    isFounderMatch: boolean;
    billingBypass: boolean;
    planOverride: string;
    entitlementSource: 'founder_override' | 'base_plan';
  };
  user: {
    id: string;
    email: string;
    name: string | null;
    basePlan: string;
    effectivePlan: string;
    trialEndsAt: string | null;
    hasStripeCustomer: boolean;
  };
  organization: {
    id: string;
    name: string | null;
    role: string | null;
  };
  environment: {
    envClass: string;
    projectRef: string;
    projectLabel: string;
    isForbiddenProjectRef: boolean;
    forbiddenProjectRefReason: string | null;
  };
  readiness: {
    founderBootstrapReady: boolean;
    founderBootstrapReason: string;
    migrationReady: boolean;
    migrationReason: string;
    founderEnvConfigured: boolean;
    liveReadinessChecklistPresent: boolean;
  };
  ai: {
    mode: string | null;
    usageMonth: string;
    totalDrafts: number;
    totalTokens: number;
    totalCostUsd: number;
  };
  memory: {
    mode: string;
    enabled: boolean;
    addonActive: boolean;
    readLimitMonthly: number;
    writeLimitMonthly: number;
    readsUsed: number;
    writesUsed: number;
  };
  pms: {
    provider: string | null;
    status: string | null;
    accountId: string | null;
    lastSyncAt: string | null;
  };
  recentBillingEvents: Array<{
    event_name: string;
    source: string | null;
    properties: Record<string, unknown>;
    created_at: string;
  }>;
}

export async function getFounderDiagnostics(): Promise<FounderDiagnosticsResponse> {
  const { data } = await apiClient.get<FounderDiagnosticsResponse>('/api/analytics/founder-diagnostics');
  return data;
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

export interface HostawayListingRecord {
  id: number;
  name?: string;
  externalListingName?: string;
  address?: string;
  city?: string;
  state?: string;
  countryCode?: string;
  bedrooms?: number;
  bathrooms?: number;
  personCapacity?: number;
  thumbnailUrl?: string | null;
  picture?: string | null;
  [key: string]: unknown;
}

export interface HostawayCalendarReservationRecord {
  id: number;
  listingMapId: number;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  arrivalDate: string;
  departureDate: string;
  status?: string;
  totalPrice?: number;
  currency?: string;
  adults?: number;
  children?: number;
  nights?: number;
  channelName?: string;
  isBlocked?: boolean;
  [key: string]: unknown;
}

export interface HostawayConversationRecord {
  id: number;
  listingMapId: number;
  reservationId?: number;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestPicture?: string;
  channelId?: number;
  channelName?: string;
  arrivalDate?: string;
  departureDate?: string;
  isArchived?: boolean;
  isRead?: boolean;
  lastMessage?: string;
  lastMessageSentAt?: string;
  listingName?: string;
  source?: string;
  guest?: {
    id?: number;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    picture?: string;
  };
  reservation?: {
    id?: number;
    guestName?: string;
    guestFirstName?: string;
    guestLastName?: string;
    guestEmail?: string;
    guestPhone?: string;
  };
  [key: string]: unknown;
}

export interface HostawayMessageRecord {
  id: number;
  conversationId: number;
  body: string;
  isIncoming: boolean;
  status: string;
  insertedOn: string;
  sentOn?: string;
  senderName?: string;
  [key: string]: unknown;
}

export interface HostawayReservationRecord {
  id: number;
  listingMapId: number;
  channelId?: number;
  channelName?: string;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  arrivalDate?: string;
  departureDate?: string;
  status?: string;
  totalPrice?: number;
  currency?: string;
  adults?: number;
  children?: number;
  source?: string;
  [key: string]: unknown;
}

export interface HostawayHistorySyncJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  phase: 'idle' | 'conversations' | 'messages' | 'analyzing' | 'complete' | 'error';
  dateRangeMonths: number;
  processedConversations: number;
  totalConversations: number;
  processedMessages: number;
  totalMessages: number;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payloadAvailable: boolean;
  isRunningInMemory: boolean;
}

export async function getHostawayStatus(): Promise<HostawayStatus> {
  const { data } = await apiClient.get<HostawayStatus>('/api/hostaway');
  return data;
}

export async function connectHostaway(accountId: string, apiKey: string): Promise<{
  status: string;
  provider: string;
  accountId: string;
  connectedAt: string;
  historySyncJob?: HostawayHistorySyncJob | null;
}> {
  const { data } = await apiClient.post<{
    status: string;
    provider: string;
    accountId: string;
    connectedAt: string;
    historySyncJob?: HostawayHistorySyncJob | null;
  }>('/api/hostaway', { accountId, apiKey });
  return data;
}

export async function disconnectHostaway(): Promise<void> {
  await apiClient.delete('/api/hostaway');
}

export async function syncHostaway(): Promise<{ properties: unknown[]; syncedAt: string }> {
  const { data } = await apiClient.post<{ properties: unknown[]; syncedAt: string }>('/api/hostaway/sync', {});
  return data;
}

export async function getHostawayListingsViaServer(limit = 100): Promise<HostawayListingRecord[]> {
  const { data } = await apiClient.get<{ result: HostawayListingRecord[] }>(`/api/hostaway/listings?limit=${limit}`);
  return data.result || [];
}

export async function getHostawayListingDetailViaServer(
  listingId: number
): Promise<HostawayListingRecord | null> {
  const { data } = await apiClient.get<{ result: HostawayListingRecord | null }>(
    `/api/hostaway/listings/${listingId}`
  );
  return data.result || null;
}

export async function getHostawayConversationsViaServer(
  limit = 50,
  offset = 0
): Promise<HostawayConversationRecord[]> {
  const { data } = await apiClient.get<{ result: HostawayConversationRecord[] }>(
    `/api/hostaway/conversations?limit=${limit}&offset=${offset}`
  );
  return data.result || [];
}

export async function getHostawayMessagesViaServer(
  conversationId: number,
  limit = 100,
  offset = 0
): Promise<HostawayMessageRecord[]> {
  const { data } = await apiClient.get<{ result: HostawayMessageRecord[] }>(
    `/api/hostaway/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`
  );
  return data.result || [];
}

export async function getHostawayReservationViaServer(
  reservationId: number
): Promise<HostawayReservationRecord | null> {
  const { data } = await apiClient.get<{ result: HostawayReservationRecord | null }>(
    `/api/hostaway/reservations/${reservationId}`
  );
  return data.result || null;
}

export async function sendHostawayMessageViaServer(
  conversationId: number,
  body: string
): Promise<HostawayMessageRecord | null> {
  const { data } = await apiClient.post<{ result: HostawayMessageRecord | null }>(
    `/api/hostaway/conversations/${conversationId}/messages`,
    { body }
  );
  return data.result || null;
}

export async function startHostawayHistorySyncViaServer(
  dateRangeMonths: number
): Promise<HostawayHistorySyncJob> {
  const { data } = await apiClient.post<{ job: HostawayHistorySyncJob }>(
    '/api/hostaway/history-sync/start',
    { dateRangeMonths }
  );
  return data.job;
}

export async function getHostawayHistorySyncStatusViaServer(): Promise<HostawayHistorySyncJob | null> {
  const { data } = await apiClient.get<{ job: HostawayHistorySyncJob | null }>(
    '/api/hostaway/history-sync/status'
  );
  return data.job;
}

export async function clearHostawayHistorySyncViaServer(): Promise<void> {
  await apiClient.delete('/api/hostaway/history-sync/status');
}

export async function getHostawayHistorySyncResultViaServer(
  jobId?: string
): Promise<{
  job: HostawayHistorySyncJob | null;
  result: {
    conversations: Record<string, unknown>[];
    messages: Record<string, Record<string, unknown>[]>;
  } | null;
}> {
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
  const { data } = await apiClient.get<{
    job: HostawayHistorySyncJob | null;
    result: {
      conversations: Record<string, unknown>[];
      messages: Record<string, Record<string, unknown>[]>;
    } | null;
  }>(`/api/hostaway/history-sync/result${query}`);
  return data;
}

export async function getHostawayCalendarReservationsViaServer(options?: {
  startDate?: string;
  endDate?: string;
  listingId?: number;
  status?: string;
}): Promise<HostawayCalendarReservationRecord[]> {
  const limit = 100;
  const allReservations: HostawayCalendarReservationRecord[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (options?.startDate) params.set('arrivalStartDate', options.startDate);
    if (options?.endDate) params.set('arrivalEndDate', options.endDate);
    if (options?.listingId) params.set('listingId', String(options.listingId));
    if (options?.status) params.set('status', options.status);

    const { data } = await apiClient.get<{ result: HostawayCalendarReservationRecord[] }>(
      `/api/hostaway/reservations?${params.toString()}`
    );
    const page = data.result || [];
    allReservations.push(...page);
    hasMore = page.length === limit;
    offset += limit;
  }

  return allReservations;
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
