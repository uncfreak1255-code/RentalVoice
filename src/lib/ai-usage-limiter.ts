// AI Usage Limiter — client-side rate limiting and usage tracking
// Tracks daily/monthly draft counts, enforces per-minute burst limits
// Persisted to AsyncStorage for cross-session tracking

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Tier Configuration ──────────────────────────────────────
export type UsageTier = 'free' | 'starter' | 'pro';

interface TierLimits {
  draftsPerDay: number;
  draftsPerMonth: number;
  requestsPerMinute: number;
  label: string;
}

export const TIER_LIMITS: Record<UsageTier, TierLimits> = {
  free:    { draftsPerDay: 10,  draftsPerMonth: 200,    requestsPerMinute: 3,  label: 'Free' },
  starter: { draftsPerDay: 50,  draftsPerMonth: 1500,   requestsPerMinute: 5,  label: 'Starter' },
  pro:     { draftsPerDay: 999, draftsPerMonth: 999999, requestsPerMinute: 10, label: 'Pro' },
};

// ─── Storage Keys ────────────────────────────────────────────
const USAGE_KEY = 'ai_usage_data';
const TIER_KEY = 'ai_usage_tier';

// ─── Types ───────────────────────────────────────────────────
interface DailyUsage {
  date: string; // YYYY-MM-DD
  count: number;
}

interface MonthlyUsage {
  month: string; // YYYY-MM
  count: number;
  estimatedTokens: number;
}

interface UsageData {
  daily: DailyUsage;
  monthly: MonthlyUsage;
  recentTimestamps: number[]; // timestamps of recent requests for burst limiting
  totalAllTime: number;
}

export interface UsageStats {
  tier: UsageTier;
  tierLabel: string;
  draftsToday: number;
  draftsThisMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyPercentage: number; // 0-100
  totalAllTime: number;
  isAtDailyLimit: boolean;
  isAtMonthlyLimit: boolean;
  estimatedTokensThisMonth: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

// ─── Helpers ─────────────────────────────────────────────────
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// ─── Storage ─────────────────────────────────────────────────
async function loadUsageData(): Promise<UsageData> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as UsageData;
      // Reset daily if it's a new day
      if (data.daily.date !== getTodayKey()) {
        data.daily = { date: getTodayKey(), count: 0 };
      }
      // Reset monthly if it's a new month
      if (data.monthly.month !== getMonthKey()) {
        data.monthly = { month: getMonthKey(), count: 0, estimatedTokens: 0 };
      }
      // Clean old timestamps (older than 2 minutes)
      const cutoff = Date.now() - 120_000;
      data.recentTimestamps = data.recentTimestamps.filter(t => t > cutoff);
      return data;
    }
  } catch (e) {
    console.error('[UsageLimiter] Failed to load usage data:', e);
  }
  return {
    daily: { date: getTodayKey(), count: 0 },
    monthly: { month: getMonthKey(), count: 0, estimatedTokens: 0 },
    recentTimestamps: [],
    totalAllTime: 0,
  };
}

async function saveUsageData(data: UsageData): Promise<void> {
  try {
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[UsageLimiter] Failed to save usage data:', e);
  }
}

// ─── Tier Management ─────────────────────────────────────────
export async function getCurrentTier(): Promise<UsageTier> {
  try {
    const tier = await AsyncStorage.getItem(TIER_KEY);
    if (tier && tier in TIER_LIMITS) return tier as UsageTier;
  } catch (e) {
    console.error('[UsageLimiter] Failed to load tier:', e);
  }
  return 'starter'; // Default tier
}

export async function setCurrentTier(tier: UsageTier): Promise<void> {
  await AsyncStorage.setItem(TIER_KEY, tier);
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Check if the user can generate a draft right now.
 * Returns { allowed: true } or { allowed: false, reason: '...' }
 */
export async function canGenerateDraft(): Promise<RateLimitResult> {
  const [data, tier] = await Promise.all([loadUsageData(), getCurrentTier()]);
  const limits = TIER_LIMITS[tier];

  // 1. Check burst limit (requests per minute)
  const oneMinuteAgo = Date.now() - 60_000;
  const recentCount = data.recentTimestamps.filter(t => t > oneMinuteAgo).length;
  if (recentCount >= limits.requestsPerMinute) {
    const oldestInWindow = Math.min(...data.recentTimestamps.filter(t => t > oneMinuteAgo));
    const retryAfterMs = oldestInWindow + 60_000 - Date.now();
    return {
      allowed: false,
      reason: `Too many requests. Please wait ${Math.ceil(retryAfterMs / 1000)}s.`,
      retryAfterMs,
    };
  }

  // 2. Check daily limit
  if (data.daily.count >= limits.draftsPerDay) {
    return {
      allowed: false,
      reason: `Daily limit reached (${limits.draftsPerDay} drafts/day). Resets at midnight.`,
    };
  }

  // 3. Check monthly limit
  if (data.monthly.count >= limits.draftsPerMonth) {
    return {
      allowed: false,
      reason: `Monthly limit reached (${limits.draftsPerMonth} drafts/month).`,
    };
  }

  return { allowed: true };
}

/**
 * Record a successful draft generation.
 * Call this AFTER the AI responds successfully.
 */
export async function recordDraftGeneration(estimatedTokens: number = 800): Promise<void> {
  const data = await loadUsageData();

  data.daily.count += 1;
  data.monthly.count += 1;
  data.monthly.estimatedTokens += estimatedTokens;
  data.totalAllTime += 1;
  data.recentTimestamps.push(Date.now());

  // Keep only last 20 timestamps for memory
  if (data.recentTimestamps.length > 20) {
    data.recentTimestamps = data.recentTimestamps.slice(-20);
  }

  await saveUsageData(data);
  console.log(`[UsageLimiter] Draft recorded. Today: ${data.daily.count}, Month: ${data.monthly.count}`);
}

/**
 * Get usage stats for the Settings UI.
 */
export async function getUsageStats(): Promise<UsageStats> {
  const [data, tier] = await Promise.all([loadUsageData(), getCurrentTier()]);
  const limits = TIER_LIMITS[tier];

  return {
    tier,
    tierLabel: limits.label,
    draftsToday: data.daily.count,
    draftsThisMonth: data.monthly.count,
    dailyLimit: limits.draftsPerDay,
    monthlyLimit: limits.draftsPerMonth,
    dailyPercentage: Math.min(100, Math.round((data.daily.count / limits.draftsPerDay) * 100)),
    totalAllTime: data.totalAllTime,
    isAtDailyLimit: data.daily.count >= limits.draftsPerDay,
    isAtMonthlyLimit: data.monthly.count >= limits.draftsPerMonth,
    estimatedTokensThisMonth: data.monthly.estimatedTokens,
  };
}

/**
 * Reset daily usage (for testing).
 */
export async function resetDailyUsage(): Promise<void> {
  const data = await loadUsageData();
  data.daily = { date: getTodayKey(), count: 0 };
  data.recentTimestamps = [];
  await saveUsageData(data);
}
