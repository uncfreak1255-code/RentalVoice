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

// v1: personal mode only. Commercial mode deferred to Phase 4.
export const APP_MODE: AppMode = 'personal';

// v1: hardcoded to personal — commercial comparisons kept for Phase 4 reactivation.
export const isCommercial: boolean = (APP_MODE as string) === 'commercial';
export const isPersonal: boolean = (APP_MODE as string) === 'personal';

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
