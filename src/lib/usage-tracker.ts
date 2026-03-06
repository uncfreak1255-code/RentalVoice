/**
 * Usage Tracker
 * 
 * Silent usage tracking for draft generation, provider usage, and analytics.
 * Persists to AsyncStorage. No user-facing UI — just data collection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const USAGE_KEY = 'rv-usage-data';

export interface UsageData {
  /** Current billing month (YYYY-MM format) */
  currentMonth: string;
  /** Drafts generated this month */
  draftsThisMonth: number;
  /** Drafts by provider */
  draftsByProvider: Record<string, number>;
  /** Drafts by day (YYYY-MM-DD -> count) */
  draftsByDay: Record<string, number>;
  /** Total drafts all time */
  totalDrafts: number;
  /** Average confidence score */
  avgConfidence: number;
  /** Auto-pilot sends this month */
  autoPilotSends: number;
  /** Drafts that were edited before sending */
  editedDrafts: number;
  /** Drafts sent without edits */
  approvedAsIs: number;
  /** Drafts rejected */
  rejectedDrafts: number;
  /** Billing telemetry counters */
  billingEvents: Record<string, number>;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultUsageData(): UsageData {
  return {
    currentMonth: getCurrentMonth(),
    draftsThisMonth: 0,
    draftsByProvider: {},
    draftsByDay: {},
    totalDrafts: 0,
    avgConfidence: 0,
    autoPilotSends: 0,
    editedDrafts: 0,
    approvedAsIs: 0,
    rejectedDrafts: 0,
    billingEvents: {},
  };
}

/** Load usage data from storage */
async function loadUsageData(): Promise<UsageData> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    if (!raw) return getDefaultUsageData();

    const data: UsageData = JSON.parse(raw);
    
    // Reset if month changed
    const currentMonth = getCurrentMonth();
    if (data.currentMonth !== currentMonth) {
      return {
        ...getDefaultUsageData(),
        totalDrafts: data.totalDrafts,
        avgConfidence: data.avgConfidence,
      };
    }
    
    return data;
  } catch {
    return getDefaultUsageData();
  }
}

/** Save usage data to storage */
async function saveUsageData(data: UsageData): Promise<void> {
  try {
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[UsageTracker] Failed to save:', error);
  }
}

/** Track a draft generation event */
export async function trackDraftGenerated(provider: string, confidence: number): Promise<void> {
  const data = await loadUsageData();
  const today = getToday();

  data.draftsThisMonth++;
  data.totalDrafts++;
  data.draftsByProvider[provider] = (data.draftsByProvider[provider] || 0) + 1;
  data.draftsByDay[today] = (data.draftsByDay[today] || 0) + 1;
  
  // Running average of confidence
  const totalSamples = data.draftsThisMonth;
  data.avgConfidence = ((data.avgConfidence * (totalSamples - 1)) + confidence) / totalSamples;

  await saveUsageData(data);
}

/** Track draft outcome */
export async function trackDraftOutcomeUsage(outcome: 'approved' | 'edited' | 'rejected'): Promise<void> {
  const data = await loadUsageData();
  
  switch (outcome) {
    case 'approved': data.approvedAsIs++; break;
    case 'edited': data.editedDrafts++; break;
    case 'rejected': data.rejectedDrafts++; break;
  }

  await saveUsageData(data);
}

/** Track auto-pilot send */
export async function trackAutoPilotSend(): Promise<void> {
  const data = await loadUsageData();
  data.autoPilotSends++;
  await saveUsageData(data);
}

/** Track billing/paywall events */
export async function trackBillingEvent(
  event:
    | 'billing_screen_viewed'
    | 'billing_checkout_started'
    | 'billing_portal_opened'
    | 'billing_memory_addon_enabled'
    | 'billing_memory_addon_disabled'
    | 'billing_returned',
  properties?: Record<string, string | number | boolean | null | undefined>
): Promise<void> {
  const data = await loadUsageData();
  const suffix = properties
    ? Object.entries(properties)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${String(value)}`)
        .join('|')
    : '';
  const eventKey = suffix ? `${event}|${suffix}` : event;
  data.billingEvents[eventKey] = (data.billingEvents[eventKey] || 0) + 1;
  await saveUsageData(data);
}

/** Get current usage data (for display) */
export async function getUsageData(): Promise<UsageData> {
  return loadUsageData();
}

/** Get drafts remaining for current tier */
export async function getDraftsRemaining(maxDraftsPerMonth: number): Promise<number> {
  const data = await loadUsageData();
  if (maxDraftsPerMonth === Infinity) return Infinity;
  return Math.max(0, maxDraftsPerMonth - data.draftsThisMonth);
}

/** Check if user is at or near draft limit */
export async function getDraftLimitStatus(maxDraftsPerMonth: number): Promise<'ok' | 'warning' | 'blocked'> {
  if (maxDraftsPerMonth === Infinity) return 'ok';
  const data = await loadUsageData();
  const ratio = data.draftsThisMonth / maxDraftsPerMonth;
  if (ratio >= 1) return 'blocked';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}
