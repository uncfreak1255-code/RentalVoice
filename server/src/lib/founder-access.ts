import type { PlanTier } from './types.js';

function parseCsvList(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.toLowerCase())
  );
}

function normalize(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

const founderEmails = parseCsvList(process.env.FOUNDER_EMAILS);
const founderUserIds = parseCsvList(process.env.FOUNDER_USER_IDS);
const FORBIDDEN_FOUNDER_PROJECT_REFS: Record<string, string> = {
  gqnocsoouudbogwislsl: 'linked_test_project_with_test_smoke_app_users_only',
  cqbzsntmlwpsaxwnoath: 'legacy_project_with_no_app_auth_users',
};

function getFounderPlan(): PlanTier {
  const raw = (process.env.FOUNDER_PLAN_OVERRIDE || 'enterprise').toLowerCase();
  if (raw === 'starter' || raw === 'professional' || raw === 'business' || raw === 'enterprise') {
    return raw;
  }
  return 'enterprise';
}

function founderBillingBypassEnabled(): boolean {
  return (process.env.FOUNDER_BILLING_BYPASS || 'true').toLowerCase() !== 'false';
}

export function isFounderAccount(userId?: string | null, email?: string | null): boolean {
  const normalizedUserId = normalize(userId);
  const normalizedEmail = normalize(email);
  if (!normalizedUserId && !normalizedEmail) return false;
  return founderUserIds.has(normalizedUserId) || founderEmails.has(normalizedEmail);
}

export function getEffectivePlan(
  basePlan: PlanTier,
  userId?: string | null,
  email?: string | null,
): PlanTier {
  if (!isFounderAccount(userId, email)) return basePlan;
  return getFounderPlan();
}

export function getFounderPlanOverride(): PlanTier {
  return getFounderPlan();
}

export function shouldBypassBillingForFounder(
  userId?: string | null,
  email?: string | null,
): boolean {
  return isFounderAccount(userId, email) && founderBillingBypassEnabled();
}

export function getEntitlementSource(
  basePlan: PlanTier,
  userId?: string | null,
  email?: string | null,
): 'founder_override' | 'base_plan' {
  return getEffectivePlan(basePlan, userId, email) === basePlan ? 'base_plan' : 'founder_override';
}

export function getForbiddenFounderProjectRefReason(projectRef?: string | null): string | null {
  if (!projectRef) return null;
  return FORBIDDEN_FOUNDER_PROJECT_REFS[projectRef] || null;
}
