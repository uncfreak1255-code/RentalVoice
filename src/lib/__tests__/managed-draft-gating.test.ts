import { shouldUseManagedDrafts } from '../managed-draft-gating';

describe('shouldUseManagedDrafts', () => {
  it('enables managed drafts for a verified founder session even when app mode is personal', () => {
    expect(
      shouldUseManagedDrafts({
        serverProxiedAI: false,
        hasFounderSession: true,
      }),
    ).toBe(true);
  });

  it('keeps unauthenticated personal users on the local path', () => {
    expect(
      shouldUseManagedDrafts({
        serverProxiedAI: false,
        hasFounderSession: false,
      }),
    ).toBe(false);
  });

  it('keeps managed drafts on when server mode is already active', () => {
    expect(
      shouldUseManagedDrafts({
        serverProxiedAI: true,
        hasFounderSession: false,
      }),
    ).toBe(true);
  });
});
