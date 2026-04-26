# Rental Voice open risks

Last updated: 2026-04-26

## Highest risks

1. **The personal-pivot is unvalidated on real conversations.**
   - PR #59 ships the architecture; it has not been A/B tested on real Hostaway threads against the prior Gemini path.
   - Until the owner generates 3-5 real drafts on the SDK path and confirms quality is at least as good as Gemini, "we pivoted" and "it works" are different claims.
   - Risk: SDK output drifts from Gemini behavior in subtle ways (banned phrases, length, tone) and quality regresses without anyone noticing because the user is the only QA.

2. **Existing waitlist signups have no comms plan.**
   - The landing page collected emails on the assumption Rental Voice was launching publicly.
   - As of the pivot, those signups go nowhere. No email has been sent. The form is still live.
   - Risk: integrity / trust if anyone notices and asks. Low blast radius (small N, niche audience), but a real open loop.
   - Decision needed: send a one-time "we pivoted, sorry" email, redirect the form, or let it die quietly.

3. **The Tailscale + local-server runtime introduces new failure modes single-user-only.**
   - If the owner's host machine is off, AI drafts fail.
   - If Tailscale ACLs change, the phone can't reach the server.
   - If `claude` logs out on the host, the SDK call fails silently.
   - Mitigation: `USE_CLAUDE_SUBSCRIPTION=0` flips back to the API-key path. But the API key isn't currently set in prod env, so the rollback isn't actually wired through.

4. **Multi-tenant code is still live and reachable until the deletion PR lands.**
   - Billing, entitlements, founder-canary multi-tenancy, waitlist, dual-PMS adapters, `/api/ai-proxy/test-key`, etc. are all still in `main`.
   - Risk: code paths that should be dead are still callable. Surface area for bugs nobody is looking at.
   - Mitigation: deletion plan exists at `docs/plans/2026-04-26-multi-tenant-deletion.md`; execution is the next batch.

5. **The live personal-account project is now persistent state, not disposable canary.**
   - `sawyerbeck25@gmail.com` in `zsitbuwzxtsgfqzhtged` is the owner's real working data.
   - Casual reruns of bootstrap or destructive tests against this project would damage real state.
   - Mitigation: bootstrap targets remain forbidden in code; documented in `current-state.md` and `CLAUDE.md`.

6. **Status documentation drifts faster than code.**
   - Pre-pivot: `current-state.md`, `next-batch.md`, `open-risks.md` were 16 days behind reality at the time of the 2026-04-26 retro.
   - Risk: future strategic ambiguity. New sessions read stale docs and head in the wrong direction.
   - Mitigation: include status doc updates in the same PR as direction-changing work (this PR is the example).

7. **Sawyer-only evals can still be misread as product proof.**
   - The eval suite was originally framed for product validation. It only measures "can the system sound like Sawyer."
   - In the personal-pivot world that's actually the right metric — but it would have been wrong if the public direction had stayed.
   - Note: this risk is now category-correct, not category-wrong.

## Operational mitigations in place

- Protected baseline tooling
- Explicit environment classification in runtime manifests
- Live preflight + rehearsal preflight with forbidden project-ref gating
- Dedicated live personal-account project `zsitbuwzxtsgfqzhtged`
- Local live env file (`.env.live.local`)
- `USE_CLAUDE_SUBSCRIPTION=0` rollback flag
- EAS secrets for tailnet identifiers (no longer committed)

## Closed risks (post-pivot)

The following risks tracked the public-product direction and are now obsolete:

- ~~Durable app identity is missing from the default app architecture~~ — single-user; identity is the host machine.
- ~~Public account-first onboarding path is missing~~ — public path no longer the goal.
- ~~Durable account-backed AI learning is founder-canary only~~ — there is only one user; "founder-canary" is now "the user."
