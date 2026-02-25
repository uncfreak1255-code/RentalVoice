/**
 * Subscription Tier Definitions
 * 
 * Central config for all subscription tiers.
 * Property caps are the gate — AI quality is the same across all tiers.
 */

export type TierName = 'free' | 'starter' | 'pro' | 'business';

export interface TierConfig {
  id: TierName;
  name: string;
  price: number;
  maxProperties: number;
  maxDraftsPerMonth: number;
  autopilotEnabled: boolean;
  smartRouting: boolean;
  reviewResponses: boolean;
  revenueCatProductId: string;
  /** Features to highlight in paywall */
  highlights: string[];
}

export const TIERS: Record<TierName, TierConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    maxProperties: 1,
    maxDraftsPerMonth: 10,
    autopilotEnabled: false,
    smartRouting: false,
    reviewResponses: false,
    revenueCatProductId: '',
    highlights: ['1 property', '10 drafts/month', 'AI-powered replies'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 19,
    maxProperties: 3,
    maxDraftsPerMonth: 200,
    autopilotEnabled: false,
    smartRouting: false,
    reviewResponses: false,
    revenueCatProductId: 'rv_starter_monthly',
    highlights: ['3 properties', '200 drafts/month', 'Style learning'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 49,
    maxProperties: 10,
    maxDraftsPerMonth: 1000,
    autopilotEnabled: true,
    smartRouting: true,
    reviewResponses: true,
    revenueCatProductId: 'rv_pro_monthly',
    highlights: ['10 properties', '1,000 drafts/month', 'AutoPilot', 'Smart model routing', 'Review responses'],
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 99,
    maxProperties: Infinity,
    maxDraftsPerMonth: Infinity,
    autopilotEnabled: true,
    smartRouting: true,
    reviewResponses: true,
    revenueCatProductId: 'rv_business_monthly',
    highlights: ['Unlimited properties', 'Unlimited drafts', 'AutoPilot', 'Priority support', 'Team access'],
  },
};

/** Get tier config by name */
export function getTierConfig(tier: TierName): TierConfig {
  return TIERS[tier];
}

/** Get the next tier upgrade from current */
export function getNextTier(current: TierName): TierName | null {
  const order: TierName[] = ['free', 'starter', 'pro', 'business'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

/** Check if a tier has a specific feature */
export function tierHasFeature(tier: TierName, feature: keyof Pick<TierConfig, 'autopilotEnabled' | 'smartRouting' | 'reviewResponses'>): boolean {
  return TIERS[tier][feature];
}

/** Get all tiers as array (for paywall display) */
export function getAllTiers(): TierConfig[] {
  return Object.values(TIERS);
}

/** Format property limit for display */
export function formatPropertyLimit(tier: TierName): string {
  const config = TIERS[tier];
  return config.maxProperties === Infinity ? 'Unlimited' : String(config.maxProperties);
}

/** Format draft limit for display */
export function formatDraftLimit(tier: TierName): string {
  const config = TIERS[tier];
  if (config.maxDraftsPerMonth === Infinity) return 'Unlimited';
  return config.maxDraftsPerMonth.toLocaleString();
}
