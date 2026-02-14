/**
 * App Configuration & Mode Detection
 * 
 * Controls dual-mode behavior:
 * - 'personal': Direct API calls, local storage, no auth (current behavior)
 * - 'commercial': Server-proxied AI, auth required, Stripe billing
 * 
 * Default: 'personal' — your daily workflow is never affected.
 */

export type AppMode = 'personal' | 'commercial';

export const APP_MODE: AppMode = 
  (process.env.EXPO_PUBLIC_APP_MODE as AppMode) || 'personal';

export const isCommercial = APP_MODE === 'commercial';
export const isPersonal = APP_MODE === 'personal';

/**
 * API base URL for commercial mode backend.
 * In personal mode, this is unused — calls go direct to AI providers.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.rentalvoice.app';

/**
 * Feature flags derived from mode.
 * Personal mode keeps ALL current behavior intact.
 */
export const features = {
  /** Require login/signup before accessing the app */
  requireAuth: isCommercial,
  
  /** Route AI calls through the backend proxy */
  serverProxiedAI: isCommercial,
  
  /** Sync data to server database */
  serverSync: isCommercial,
  
  /** Show billing/subscription UI */
  billing: isCommercial,
  
  /** Show PMS OAuth connection flow (vs env var credentials) */
  pmsOAuth: isCommercial,
  
  /** Track AI usage for metering */
  usageMetering: isCommercial,
  
  /** Show onboarding for new commercial users */
  commercialOnboarding: isCommercial,
  
  /** Always available features (both modes) */
  aiDrafts: true,
  languageDetection: true,
  propertyKnowledge: true,
  autopilot: true,
  analytics: true,
  sentimentAnalysis: true,
} as const;

/**
 * Log current mode on startup (development only)
 */
if (__DEV__) {
  console.log(`[Config] App mode: ${APP_MODE}`);
  console.log(`[Config] Server AI: ${features.serverProxiedAI}`);
  console.log(`[Config] Auth required: ${features.requireAuth}`);
}
