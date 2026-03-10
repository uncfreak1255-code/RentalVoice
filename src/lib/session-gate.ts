export interface RestoreOutcome {
  connected: boolean;
  accountId?: string;
  apiKey?: string;
  needsReauth?: boolean;
}

interface SessionGateInput {
  isOnboarded: boolean;
  isDemoMode: boolean;
  restoreResult: RestoreOutcome | null;
}

interface SessionGateOutput {
  route: '/(tabs)' | '/onboarding';
  shouldRecoverSession: boolean;
}

export function getAppEntryDestination({
  isOnboarded,
  isDemoMode,
  restoreResult,
}: SessionGateInput): SessionGateOutput {
  if (isDemoMode && isOnboarded) {
    return { route: '/(tabs)', shouldRecoverSession: false };
  }

  if (restoreResult?.connected && restoreResult.accountId && restoreResult.apiKey) {
    return {
      route: '/(tabs)',
      shouldRecoverSession: !isOnboarded,
    };
  }

  if (restoreResult?.needsReauth) {
    return { route: '/onboarding', shouldRecoverSession: false };
  }

  return { route: '/onboarding', shouldRecoverSession: false };
}
