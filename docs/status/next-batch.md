# Rental Voice next batch

Last updated: 2026-04-26

## Approved next engineering batch

Validate the personal-pivot architecture (PR #59) on real Hostaway conversations, then delete the multi-tenant infrastructure that the pivot replaces.

This batch supersedes the 2026-04-10 batch ("public account-first onboarding proof"), which is now off the table per the strategic decision recorded in PR #59.

## Scope

1. **Validate the SDK swap end to end.** Owner runs the dev variant build on their phone over Tailscale, generates 3-5 real drafts using `USE_CLAUDE_SUBSCRIPTION=1`, compares quality against the prior Gemini path. Validation done = pivot real.
2. **Execute the multi-tenant deletion plan** (`docs/plans/2026-04-26-multi-tenant-deletion.md`). Removes billing, entitlements, waitlist, dual-PMS adapters, server-managed Hostaway routes, the `commercial` mode flag, and App Store submission tooling. One PR, deletion-only, no behavior change to the personal path.
3. **Decide what to do about the existing waitlist signups.** Open question. Options include: a one-time email explaining the pivot, a redirect to a "shutting down" landing page, or just letting the form go dormant. No code work blocks on this; it's a comms decision.
4. **Document the local operating model.** A README section or runbook explaining how to start the local server, set EAS secrets, install the dev build, and rotate the proxy token. Targets the owner's own future self in 6 months.
5. **Resume voice-accuracy work.** With the AI provider question settled, the bottleneck shifts back to draft quality. The promptfoo baseline is 47.92%; the goal of >55% on the existing eval suite is still the right next target.

## Constraints

- Keep the personal-mode UX functional throughout. No hard breaks during the deletion pass.
- Keep the rollback flag (`USE_CLAUDE_SUBSCRIPTION=0`) working until validation confirms the SDK path is reliable in real use.
- Do not relink `server/.env` away from `test`.
- Do not casually rerun bootstrap against the live personal account in `zsitbuwzxtsgfqzhtged`.
- Do not delete code paths the personal flow still uses. The deletion plan must explicitly trace each removed file/route to "no personal-mode caller."

## Definition of done for this batch

- PR #59 merges with all `/review` issues resolved and validation evidence in the PR body.
- The multi-tenant deletion PR merges cleanly with the personal flow still functional.
- A short operator runbook exists for "how I run my own copy of this."
- Voice accuracy work has a fresh baseline run on the SDK path.

## Out of scope

- Re-opening any path toward public distribution.
- Building infrastructure for hypothetical other users.
- App Store / TestFlight submissions of any kind.
- Multi-PMS support (still parked).
- Stripe billing (no longer relevant).

## Execution docs

- `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-04-25-personal-pivot-claude-sdk.md` (the plan that describes the pivot)
- `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-04-26-multi-tenant-deletion.md` (the deletion plan, written alongside this status update)
