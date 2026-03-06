---
description: Run App Store pre-submission checklist
model: sonnet
---

Run the full App Store pre-submission checklist for RentalVoice:

1. **Functional screens**: Verify every navigable screen renders without crashes. Check all routes in `src/app/` — no "coming soon" placeholders allowed.

2. **Account deletion**: Confirm `DELETE /api/account` endpoint exists and works in `server/src/routes/account.ts`.

3. **Privacy**: Check that privacy policy URL at `rentalvoice.app/privacy` is referenced correctly.

4. **LLM safeguards**: Verify content filtering is applied to AI outputs in `src/lib/ai-enhanced.ts` and `server/src/services/ai-proxy.ts`.

5. **Type safety**: Run `npm run typecheck` and report any errors.

6. **Lint**: Run `npm run lint` and report any errors.

7. **Tests**: Run `npx jest --passWithNoTests` and report results.

8. **Known debt**: Check items in CLAUDE.md "Known Technical Debt" — confirm they're non-blocking for submission.

9. **EAS config**: Verify `eas.json` production profile has auto-increment and correct channel.

Report a pass/fail summary for each check.
