export interface RestoreOutcome {
  connected: boolean;
  accountId?: string;
  apiKey?: string;
  needsReauth?: boolean;
}

interface SessionGateInput {
  hasFounderSession: boolean;
  isOnboarded: boolean;
  isDemoMode: boolean;
  restoreResult: RestoreOutcome | null;
  hasAccountSession: boolean;
}

interface SessionGateOutput {
  route: '/(tabs)' | '/onboarding';
  shouldRecoverSession: boolean;
}

export function getAppEntryDestination({
  hasFounderSession,
  isOnboarded,
  isDemoMode,
  restoreResult,
  hasAccountSession,
}: SessionGateInput): SessionGateOutput {
  if (hasFounderSession) {
    return { route: '/(tabs)', shouldRecoverSession: false };
  }

  if (isDemoMode && isOnboarded) {
    return { route: '/(tabs)', shouldRecoverSession: false };
  }

  if (hasAccountSession && isOnboarded) {
    return { route: '/(tabs)', shouldRecoverSession: false };
  }

  if (hasAccountSession) {
    return { route: '/onboarding', shouldRecoverSession: false };
  }

  // Existing Hostaway user with valid saved credentials — go straight to tabs
  if (restoreResult?.connected && restoreResult.accountId && restoreResult.apiKey) {
    return { route: '/(tabs)', shouldRecoverSession: true };
  }

  if (restoreResult?.needsReauth) {
    return { route: '/onboarding', shouldRecoverSession: false };
  }

  return { route: '/onboarding', shouldRecoverSession: false };
}

export function canAccessTabs({
  hasFounderSession,
  isOnboarded,
  isDemoMode,
}: Pick<SessionGateInput, 'hasFounderSession' | 'isOnboarded' | 'isDemoMode'>): boolean {
  return hasFounderSession || isOnboarded || isDemoMode;
}
