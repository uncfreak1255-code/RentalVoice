# Rental Voice open risks

Last updated: 2026-03-06

## Highest risks

1. Founder/live environment does not exist yet
- No real live Supabase app-auth environment has been designated
- Founder bootstrap cannot move past tooling/preflight until that exists

2. Current linked Supabase project is test-only
- `gqnocsoouudbogwislsl` is linked locally and contains test/smoke app users
- Running live founder or commercial cutover actions there would corrupt the rollout path

3. Personal-mode and commercial-mode assumptions can still drift
- Current product must remain Hostaway-first and personal-mode default
- Future sessions can accidentally optimize for staged commercial paths if state is not read first

4. Local environment metadata is intentionally local-only
- `server/.env` carries current project classification and should not be treated as committed truth
- The committed templates and status docs must stay aligned with it

5. Verification still depends on the local workspace, not the automation worktree
- Nightly automation may report missing toolchain capability that does not apply to the real workspace
- Use the local repo for actual verification decisions

## Operational mitigations in place

- protected baseline tooling
- explicit environment classification in runtime manifests
- live founder preflight
- rehearsal preflight with forbidden project-ref gating
- live founder env template
- founder live-readiness checklist
- founder bootstrap packet generator

## What remains blocked

- founder auth creation
- founder billing bypass validation in a real live environment
- personal-to-founder migration rehearsal on a distinct rehearsal target
- any real commercial cutover
