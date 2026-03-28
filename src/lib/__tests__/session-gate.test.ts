import { getAppEntryDestination, type RestoreOutcome } from '../session-gate';

describe('getAppEntryDestination', () => {
  it('routes to tabs for an onboarded demo user', () => {
    expect(
      getAppEntryDestination({
        hasFounderSession: false,
        isOnboarded: true,
        isDemoMode: true,
        restoreResult: null,
        hasAccountSession: false,
      })
    ).toEqual({ route: '/(tabs)', shouldRecoverSession: false });
  });

  it('routes to tabs when an account session exists and onboarding is already complete', () => {
    expect(
      getAppEntryDestination({
        hasFounderSession: false,
        isOnboarded: true,
        isDemoMode: false,
        restoreResult: null,
        hasAccountSession: true,
      })
    ).toEqual({ route: '/(tabs)', shouldRecoverSession: false });
  });

  it('routes to onboarding when an account session exists but Hostaway still needs connection', () => {
    expect(
      getAppEntryDestination({
        hasFounderSession: false,
        isOnboarded: false,
        isDemoMode: false,
        restoreResult: null,
        hasAccountSession: true,
      })
    ).toEqual({ route: '/onboarding', shouldRecoverSession: false });
  });

  it('routes to tabs when Hostaway credentials restore successfully', () => {
    const restoreResult: RestoreOutcome = {
      connected: true,
      accountId: '51916',
      apiKey: 'secret',
    };

    expect(
      getAppEntryDestination({
        hasFounderSession: false,
        isOnboarded: false,
        isDemoMode: false,
        restoreResult,
        hasAccountSession: false,
      })
    ).toEqual({ route: '/(tabs)', shouldRecoverSession: true });
  });

  it('routes to onboarding when re-authentication is required', () => {
    expect(
      getAppEntryDestination({
        hasFounderSession: false,
        isOnboarded: true,
        isDemoMode: false,
        restoreResult: { connected: false, needsReauth: true },
        hasAccountSession: false,
      })
    ).toEqual({ route: '/onboarding', shouldRecoverSession: false });
  });

  it('routes to onboarding when no prior session can be restored', () => {
    expect(
      getAppEntryDestination({
        hasFounderSession: false,
        isOnboarded: false,
        isDemoMode: false,
        restoreResult: { connected: false },
        hasAccountSession: false,
      })
    ).toEqual({ route: '/onboarding', shouldRecoverSession: false });
  });

  it('routes to tabs when a founder session exists even if onboarding state is false', () => {
    expect(
      getAppEntryDestination({
        hasFounderSession: true,
        isOnboarded: false,
        isDemoMode: false,
        restoreResult: { connected: false },
        hasAccountSession: false,
      })
    ).toEqual({ route: '/(tabs)', shouldRecoverSession: false });
  });

  it('lets founder session take precedence over Hostaway reauth fallback', () => {
    expect(
      getAppEntryDestination({
        hasFounderSession: true,
        isOnboarded: false,
        isDemoMode: false,
        restoreResult: { connected: false, needsReauth: true },
        hasAccountSession: false,
      })
    ).toEqual({ route: '/(tabs)', shouldRecoverSession: false });
  });
});
