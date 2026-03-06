# Phase 4 Master Plan: Managed Model Policy, Pricing, and Launch

## Scope
- Lock Rental Voice to managed AI mode with no BYOK paths.
- Make model selection server-governed by plan tier.
- Align pricing and Stripe metering to managed model economics.
- Ship a launch-ready messaging and packaging playbook.

## 4.1 Managed model policy (server source of truth)

### Live policy by tier
| Tier | Primary model | Fallback chain | Output cap | Cost guardrail |
|---|---|---|---|---|
| starter | Gemini 2.0 Flash | GPT-4o Mini | 700 tokens | <= $0.003 / draft |
| professional | Gemini 2.0 Flash | GPT-4o Mini | 900 tokens | <= $0.008 / draft |
| business | GPT-4o Mini | Gemini 2.0 Flash | 1200 tokens | <= $0.02 / draft |
| enterprise | GPT-4o | Claude Sonnet 4 | 1600 tokens | <= $0.08 / draft |

### Runtime guarantees
- Provider selection is determined on the server from plan policy.
- Provider API keys are always platform-managed env keys.
- Provider attempts fail over in-order if provider key is missing or upstream call fails.
- Usage is metered against the provider/model actually used.
- Autopilot never auto-sends when a fallback model was used; fallback results are routed to manual review.

## 4.2 UI behavior contract

### Settings model row
- Remains visually unchanged.
- Now displays managed model label from `/api/usage` (`managedModel.label`).
- In commercial mode, local on-device provider/key state is not used to render model identity.

### Design freeze rules
- No new visual system.
- Existing settings cards/rows/spacing/tokens remain authoritative.
- Only data source and copy changes are allowed unless explicitly requested.

## 4.3 Pricing and Stripe alignment

### Current Stripe contract
- Base subscriptions by plan stay mapped in billing route.
- Overage meter (`ai_draft_overage`) remains active for draft-volume overages.

### Pricing guardrails
- Starter remains hard-capped.
- Professional and Business overage rates remain active and should be reviewed monthly against real provider costs.
- Enterprise remains contract-driven with zero automatic overage pricing.

### Token billing pilot (optional, not required for launch)
- Keep current meter-based billing as source of truth.
- Run Stripe token billing in shadow mode for managed tenants only.
- Reconcile for 2-4 weeks before any production switch.

## 4.4 Launch packaging and messaging

### Product language
- Positioning: "Managed AI guest messaging trained on your message history."
- Trust signal: "No API keys required."
- Differentiator: "Per-property memory + host voice learning."

### Pricing page / paywall copy anchors
- Starter: "Get started with managed drafts."
- Professional: "Autopilot + higher memory capacity for growing operators."
- Business: "Team-ready automation and higher-volume managed AI."
- Enterprise: "Custom quality policy, governance, and SLA."

### App Store angle
- Focus on outcomes: faster replies, consistent brand voice, fewer manual edits.
- Avoid infra language (providers, key management, token jargon).
- Include clear privacy copy about managed processing and account isolation.

## Rollout checklist
1. Apply managed-only AI config migration.
2. Deploy server with managed model policy and fallback chain.
3. Verify `/api/usage` includes `managedModel` payload.
4. Confirm settings model row reads managed payload.
5. Review pricing copy against actual limits and overage terms.
6. Prepare launch assets (App Store copy, pricing page, onboarding updates).
