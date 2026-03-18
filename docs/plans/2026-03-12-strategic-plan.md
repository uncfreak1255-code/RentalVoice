# Rental Voice — Strategic Plan to Revenue

**Created:** 2026-03-12
**Status:** v2 — Revised after adversarial review (investor + architect)
**Author:** Claude (Anthropic Senior Developer & Strategist perspective)

---

## Executive Summary

Rental Voice has a defensible technical moat (voice-matching AI that learns from actual host writing) but zero revenue infrastructure. This plan covers the path from "founder's personal tool" to "App Store product generating recurring revenue" in 4 phases over ~7 months (revised from 6 after stress testing).

**Core thesis:** Voice accuracy is the product. Everything else — billing, onboarding, marketing — is packaging. The plan front-loads voice accuracy to 80%+ (Phase 0), then layers monetization infrastructure (Phase 1), App Store launch (Phase 2), and expansion (Phase 3-4).

**Critical gate:** If Phase 0 fails to deliver 80%+ voice confidence, the entire plan pauses. See contingency section.

---

## Phase 0: Voice Accuracy Foundation (Now → Week 6)

**Gate:** Nothing else ships until median voice confidence hits 80%.

### Why this is non-negotiable

Current state: ~45% median confidence. At this level, the AI is wrong more often than right. Users will churn before the learning system has enough data to improve. The feedback loop never kicks in.

At 80%+, the product crosses from "neat demo" to "daily driver." Users approve drafts instead of rewriting them, which feeds clean training data back into the model, which improves accuracy further. This is the flywheel.

### Workstreams

#### W0.0: Measurement First (NEW — Build Dashboard Before Fixes)
- Build confidence dashboard in Settings → AI Learning (show trend line, per-intent breakdown)
- Track approval/edit/reject rates per draft
- Establish **true baseline** before any fixes ship
- Without measurement, you can't validate whether W0.1-W0.4 actually move the needle
- **Effort:** 2-3 days
- **Why first:** Both adversarial reviewers flagged "measurement last" as a critical mistake. You need data to iterate, not just shipped code.

#### W0.0b: Consolidate detectIntent() (NEW — Prerequisite)
- Refactor 5 independent detectIntent() copies into single `IntentClassifier` service
- All trainers import from it; no local reimplementations
- Without this, every Phase 0 fix risks intent drift bugs
- **Effort:** 2 days (partially done — unified to canonical 19-intent set already)

#### W0.1: Confidence Math Fixes (In Progress)
- Remove 85% hard cap on confidence scoring
- Raise styleMatch ceiling from 75 → 95
- Add positive post-generation validation adjustments (currently penalty-only)
- Fix calibration bucketing (41-69% band too wide, no upward pressure)
- **Expected impact:** 45% → 60-65% median confidence
- **Effort:** 2-3 days (partially done)

#### W0.2: Training Data Quality
- Wire MultiPassTrainer results into generation (computed but never read)
- Raise few-shot pattern cap from 1,000 → 5,000 (currently discards 92% of 12,793 patterns)
- Extend few-shot truncation from 150/200 chars → 500/800 chars
- Implement origin tagging (host_written: 3x weight, ai_approved: 1x, ai_edited: 2.5x)
- **Expected impact:** 60-65% → 70-75% median confidence
- **Effort:** 3-4 days
- **Cost note:** Raising few-shot cap increases prompt token count. Measure token growth after shipping; re-estimate AI cost per draft.

#### W0.3: Provider Integration Fix
- Fix Gemini system_instruction (currently stuffed into user message instead of proper field)
- Remove server-side hardcoded confidence=82 (replace with per-intent dynamic confidence)
- **Expected impact:** 70-75% → 75-80% median confidence
- **Effort:** 1-2 days

#### W0.4: Voice Anchor for Novel Questions
- When no historical match exists (confidence < 50%), inject 3-5 verified host-written examples as style reference
- Only use `originType: 'host_written'` messages, diverse intents, most recent
- Prevents LLM from defaulting to generic tone on questions it hasn't seen before
- **Expected impact:** Raises floor on worst-case drafts from ~25% → 50%+
- **Effort:** 1-2 days

### Phase 0 Success Criteria
- [ ] Median voice confidence ≥ 80% across all 19 intent categories
- [ ] No single intent category below 60% confidence
- [ ] Approval rate (drafts sent without edit) ≥ 50%
- [ ] Voice accuracy validated by founder (Sawyer) on 20+ real conversations
- [ ] Token cost per draft measured and documented (baseline for financial model)

### Phase 0 Contingency (NEW — Decision Tree If 80% Not Reached)

| Result | Action |
|--------|--------|
| ≥ 80% median | Proceed to Phase 1 on schedule |
| 75-79% median | Proceed to Phase 1 but defer W2.3 (review responses) and W2.4 (listing descriptions). All Phase 2 effort focuses on voice accuracy iteration. |
| 70-74% median | Do NOT start Phase 1. Go dark for 2 weeks. Rethink approach: fewer intents? Different LLM? More training data? Radical prompt restructuring? |
| < 70% median | Pivot to "confidence floor" mode: only show drafts with 75%+ confidence, gate the rest behind manual compose. Ship as free product to build user base. Revisit monetization when accuracy catches up. |

### Phase 0 Timeline: ~5-6 weeks (revised from 3-4)
- Week 1: W0.0 (measurement dashboard) + W0.0b (consolidate detectIntent)
- Week 2: W0.1 + W0.2 (confidence math + training data quality)
- Week 3: W0.3 + W0.4 (provider fixes + voice anchor)
- Week 4-5: Iterate based on real measurement data
- Week 6: Gate decision — check contingency table

---

## Phase 1: Revenue Infrastructure (Weeks 7-12)

**Gate:** Phase 0 criteria met. Voice accuracy confirmed at 80%+.

**Parallel track:** Start direct sales outreach to local property managers during Phase 1, not after launch.

### Why billing before features

Without billing, every new feature is cost. Each AI draft costs ~$0.002-0.005 in API calls. At scale (100 users × 50 drafts/day), that's $30-75/day in AI costs with zero revenue. Billing must exist before any growth push.

### Workstreams

#### W1.1: Account System (Commercial Mode Activation)
- Wire Supabase auth as primary identity (currently Hostaway API key is identity)
- Onboarding flow: Create account → Connect Hostaway → Start learning
- Preserve personal mode as fallback for existing users during transition
- Founder account migration: move Sawyer's learning data to Supabase-backed durable storage
- **Add:** Demo/sandbox mode for App Store reviewers (no real Hostaway account needed)
- **Effort:** 5-7 days

#### W1.2: Stripe Integration via RevenueCat
- RevenueCat for App Store subscription management (handles Apple's 30% cut)
- Three tiers (revised after investor review — per-property pricing model):

| Tier | Price | Drafts/day | Properties | Features |
|------|-------|------------|------------|----------|
| **Starter** | $29/mo (1 property) | 30 | 1 | Voice learning, draft generation, confidence scoring |
| **Pro** | $49/mo + $15/property | Unlimited | Up to 5 | + Review responses, listing descriptions, priority learning |
| **Business** | $99/mo + $20/property | Unlimited | Up to 20 | + Morning briefing, pattern detection, API access |

- Free trial: 14 days of Pro (no credit card required)
- Annual discount: 20% off
- **Effort:** 6-8 days (revised up from 3-4 after architect review flagged subscription state machine complexity)

**Pricing rationale (revised):**
- Per-property pricing matches market expectation (Hospitable, NowiStay, Enso Connect all use it)
- Starter at $29/mo for 1 property = lowest entry point in the market
- Pro at $49 + $15/property = $109/mo for 5 properties (competitive with Aeve's $79-199 range)
- Business at $99 + $20/property = $499/mo for 20 properties (still under Podium/Birdeye)
- Investor concern: flat $79/mo Pro is 2-5x more expensive than per-listing competitors. Per-property model fixes this.

#### W1.3: Usage Tracking & Gating
- Track drafts generated, drafts sent, learning events, properties connected
- Enforce tier limits (soft cap with upgrade prompt, not hard block)
- Usage dashboard in Settings
- **Effort:** 3-4 days

#### W1.4: Supabase Learning Sync
- Persist learning profile to Supabase (survives app resets, device changes)
- **Sync strategy (revised after architect review):**
  - Manual "Backup Learning" button in settings (ships first)
  - Background sync only on WiFi (ships second)
  - Real-time sync deferred to Phase 3 (conflict resolution complexity)
- Restore flow on fresh install: "Restoring your AI profile..."
- **Conflict resolution:** Last-write-wins with timestamp ordering. Merge non-overlapping few-shot examples by deduplication hash `(guestMessage, hostResponse, propertyId)`. Log conflicts for founder review.
- **Effort:** 5-7 days (revised up from 3-4 after architect flagged conflict resolution)

#### W1.5: GDPR/Privacy Implementation (NEW — Required for App Store)
- Cascading delete: user → learning profile → few-shot examples → analytics events → training state
- Data retention policy: learning data retained 12 months after account deletion, then purged
- Privacy policy and terms of service documents
- CCPA/GDPR consent flow in onboarding (geolocation-based)
- **Effort:** 5-7 days
- **Why added:** Architect review identified this as App Store rejection risk. Required for subscription apps.

#### W1.6: Automated Testing (NEW — Runs Parallel)
- Unit tests: intent detection, confidence math, calibration logic
- Integration tests: draft generation pipeline end-to-end
- Billing state machine tests: trial → expired → upgrade → cancel → reactivation
- Coverage target: 70%+ on critical paths (billing, learning, auth)
- **Effort:** 2-3 weeks (runs parallel with W1.1-W1.5)
- **Why added:** Zero automated tests exist. Architect flagged this as critical risk for App Store and subscription billing.

### Phase 1 Success Criteria
- [ ] New users can sign up, connect Hostaway, and start free trial
- [ ] Stripe subscriptions work (subscribe, upgrade, downgrade, cancel)
- [ ] Usage gating enforces tier limits with upgrade prompts
- [ ] Learning data persists across app resets (manual backup + WiFi sync)
- [ ] Founder (Sawyer) has successfully migrated to durable account
- [ ] Privacy policy live, GDPR delete flow working
- [ ] Test suite passes on critical paths

### Phase 1 Timeline: ~6 weeks (revised from 4)
- Week 7-8: W1.1 (account system) + W1.4 (learning sync) + W1.6 starts (testing, parallel)
- Week 9-10: W1.2 (RevenueCat) + W1.5 (GDPR/privacy)
- Week 11-12: W1.3 (usage tracking) + integration testing + W1.6 completes

---

## Phase 2: App Store Launch (Weeks 13-18)

**Gate:** Phase 1 complete. At least 1 paying subscriber (founder) on real billing.

### Why App Store matters

TestFlight has a 90-day expiry and 10,000 tester limit. App Store provides:
- Discoverability (STR hosts search for tools)
- Credibility (listed app vs. TestFlight link)
- Payment infrastructure (Apple handles billing in 175 countries)
- Review/rating social proof

### Workstreams

#### W2.1: App Store Preparation
- App Store screenshots (6.7" and 6.5" required)
- App description, keywords, category (Business > Productivity)
- **Submit to App Store review early (week 14)** — use 2-week review window to ship features in parallel
- App Review preparation: sandbox mode for reviewers, clear privacy disclosures, proper subscription UI
- **Effort:** 3-4 days

#### W2.2: Onboarding Polish (Revised)
- First-run experience: explain what Rental Voice does, how voice learning works
- **Revised onboarding (after investor critique of 67% drop rate):**
  1. "What's your Hostaway account ID?" (single text field)
  2. "Select properties to learn from" (multi-select)
  3. "Paste 3-5 of your best guest responses" (with diverse intent templates: check-in, question, complaint, booking, departure)
  4. "Start AI assistant"
- **Target: 3-5 minute onboarding, not 10-15 minutes**
- **Add:** "Setup later" flow — let users play with demo immediately, connect Hostaway when ready
- Property setup wizard (connect Hostaway, map properties, set knowledge)
- **Effort:** 5-7 days

#### W2.3: Review Response Generation (Pro Feature)
- Same voice model, different output: generate review responses matching host tone
- **Revised (after architect review):** ALL review responses require manual approval. No auto-send, even for positive reviews. (Reduces legal liability, avoids App Store risk.)
- Platform support: Airbnb, VRBO, Google (via Hostaway review API)
- **Effort:** 5-7 days

#### W2.4: Listing Description Generation (Pro Feature)
- Generate property listing descriptions in host's voice
- Input: property knowledge + existing listing
- Output: optimized description maintaining host's authentic tone
- **Effort:** 4-5 days

#### W2.5: Launch Marketing (Revised GTM)
- **Primary channel: Direct sales to local property managers** (5 calls/week starting Week 7)
  - 50-100 Bradenton/Sarasota PMs is the addressable local market
  - Offer free 30-day trial + 1-hour onboarding call
  - Target: 3-5 paying PMs before App Store launch
  - Turn them into case studies for broader marketing
- **Secondary: Product Hunt launch** (validation play, not growth engine)
- **Tertiary: STR Facebook groups** (genuine participation, share case studies)
- **Referral program:** "Refer a host, get $10 credit per signup"
- **Affiliate partnerships:** Hostaway consultants, STR coaches, booking educators (20% commission on annual signups)
- Landing page at rentalvoice.app (or similar)
- **Effort:** Ongoing, start Week 7

### Phase 2 Success Criteria
- [ ] App approved and live on App Store
- [ ] 10+ downloads in first week
- [ ] 3+ paying subscribers in first month (ideally achieved pre-launch via direct sales)
- [ ] App Store rating ≥ 4.0 (from real users)
- [ ] Onboarding completion rate ≥ 50% (measured)

### Phase 2 Timeline: ~6 weeks (revised from 4 — includes App Store review buffer)
- Week 13: W2.1 (App Store prep) + W2.5 (marketing already running)
- Week 14: Submit to App Store + W2.2 (onboarding polish)
- Week 15-16: W2.3 (review responses) + W2.4 (listing descriptions) — built during review window
- Week 17-18: App Store approval (buffer for rejection + resubmit)

---

## Phase 3: Growth & Expansion (Months 5-7)

**Gate:** 10+ paying users. Confirmed product-market fit signal (users renewing after trial).

### Workstreams

#### W3.1: Morning Briefing (Business Tier)
- Daily digest: overnight messages, check-ins/check-outs today, issues detected, pricing opportunities
- Push notification at host's preferred time
- Actionable items with one-tap responses
- **Effort:** 5-7 days

#### W3.2: Pattern Detection (Business Tier)
- Detect recurring issues from conversation history (e.g., "WiFi complaints spike on weekends")
- Guest behavior patterns (early check-in requests cluster around holidays)
- Booking trend analysis (demand patterns, gap detection)
- **Effort:** 5-7 days

#### W3.3: Multi-PMS Support
- Guesty adapter (largest competitor PMS, ~30% market)
- Lodgify adapter
- Generic webhook/API adapter for smaller PMSs
- Architecture: PMS adapter interface already anticipated in codebase
- **Effort:** 2-3 weeks per PMS

#### W3.4: Vertical Expansion Pilot (Elevated from "Research" to "Pilot")
- **Home Services** (plumbers, electricians, HVAC): Same voice learning, different context. Customer communication via text/email. No PMS needed.
- **Why elevated:** If Airbnb builds native AI messaging (expected ~2027), STR TAM shrinks. Vertical expansion is a contingency, not a luxury.
- Build proof-of-concept with 1 local service business (Sawyer's network in Bradenton/Sarasota)
- **Effort:** 2-3 weeks for pilot

#### W3.5: Direct Booking Push
- Sawyer's #1 business priority: bypass Sarasota 7-day minimum via direct channel
- Generate direct booking landing pages per property
- Voice-consistent communication for direct guests (no PMS middleman)
- Integrate with Stripe for direct payment processing
- **Effort:** 2-3 weeks

#### W3.6: Hostaway API Resilience (NEW)
- Local message cache (store last 100 conversations per property on device)
- Hostaway webhook subscription for push-based message delivery (vs. polling)
- Offline draft mode (compose without Hostaway connection, sync on reconnect)
- **Effort:** 1-2 weeks
- **Why added:** Architect flagged Hostaway API deprecation/rate limiting as single point of failure.

### Phase 3 Success Criteria
- [ ] 50+ paying users
- [ ] MRR ≥ $2,000
- [ ] At least 1 non-STR vertical pilot running
- [ ] Multi-PMS support live (at least Guesty)
- [ ] Churn rate < 10%/month

---

## Phase 4: Scale (Month 7+)

**Gate:** MRR > $5,000. Clear unit economics (LTV > 3x CAC).

### Workstreams

#### W4.1: Autopilot Mode (Premium Add-on)
- Full autonomy within host-set bounds
- Natural language rules ("Never respond after 10pm", "10% discount for 5+ nights")
- **Revised (after architect review):** "Recall with notification" instead of "undo." Recall unpublishes from Hostaway API. Audit log for all auto-sent messages.
- **Require manual approval for first 100 auto-sends per account, then unlock full autopilot**
- Pricing: +$49/mo add-on to any tier
- **Effort:** 3-4 weeks

#### W4.2: Team/Agency Features
- Multiple team members per account
- Role-based access (owner, manager, VA)
- Per-property voice profiles (different properties can have different tones)
- **Effort:** 2-3 weeks

#### W4.3: API Access (Business Tier)
- RESTful API for programmatic draft generation
- Webhook integration for third-party tools
- Rate limiting per tier
- **Effort:** 2-3 weeks

#### W4.4: Enterprise/Agency Tier
- 20+ properties
- Custom pricing (contact sales)
- Dedicated support
- White-label option
- **Effort:** Ongoing business development

---

## Financial Model (Revised)

### Revenue Projections (Conservative, with 7% monthly churn modeled)

| Month | New Users | Churned | Active Users | ARPU | MRR | Notes |
|-------|-----------|---------|-------------|------|-----|-------|
| 1 (Launch) | 5 | 0 | 5 | $35 | $175 | Sawyer + 4 local hosts, mostly Starter |
| 2 | 12 | 0 | 17 | $38 | $650 | Direct sales + word of mouth |
| 3 | 18 | 1 | 34 | $42 | $1,430 | Product Hunt spike, Pro upgrades start |
| 4 | 20 | 2 | 52 | $45 | $2,340 | Review responses driving Pro upsell |
| 5 | 25 | 4 | 73 | $48 | $3,500 | Morning briefing driving Business upsell |
| 6 | 30 | 5 | 98 | $50 | $4,900 | Multi-PMS unlocks non-Hostaway market |
| 12 | 40 | 14 | 200 | $55 | $11,000 | Vertical expansion + referral network |

**Key changes from v1:**
- Modeled 7%/month churn starting month 3 (industry standard for $30-100/mo SaaS)
- ARPU starts at $35 (mostly Starter) and grows to $55 (mix shift to Pro/Business)
- Month 12 users revised from 300 → 200 (churn realistic)
- MRR revised from $22K → $11K (realistic with churn + lower initial ARPU)

### Cost Structure (Revised)

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Google AI (Gemini) | $2-5/user (revised up) | Prompt size grows as learning data accumulates; $0.003/draft at month 1, up to $0.009/draft by month 6 |
| Supabase | $25 (Pro) | Handles up to ~10K users |
| RevenueCat | Free → $99/mo | Free under $2.5K MRR |
| Apple's 30% cut | 30% of MRR (Year 1) | Drops to 15% in Year 2 (Small Business Program, under $1M revenue) |
| Vercel/Railway | $20-40/mo | Backend hosting |
| Monitoring (Sentry) | $26/mo | Error tracking |
| Domain/misc | $20/mo | rentalvoice.app, email, Apple developer ($99/yr) |
| Support time | $0 (founder handles) | 5-10 requests/week at 100 users |

### Unit Economics at Scale (100 users, revised)

**Conservative (Starter-heavy mix, ARPU $50):**
- Revenue per user: $50/mo
- AI cost per user: $3.50/mo (revised up for prompt growth)
- Infrastructure per user: $1.50/mo
- Apple's cut (Year 1): $15.00/user (30%)
- **Gross margin per user: $30.00/mo (60.0%)**

**Optimistic (Pro-heavy mix, ARPU $65):**
- Revenue per user: $65/mo
- AI cost per user: $3.50/mo
- Infrastructure per user: $1.50/mo
- Apple's cut: $19.50/user (30%)
- **Gross margin per user: $40.50/mo (62.3%)**

**Year 2 (Apple drops to 15%):**
- Conservative: **$37.50/mo (75.0%)** per user
- Optimistic: **$50.25/mo (77.3%)** per user

### Break-even Analysis (Revised)

Fixed costs: ~$190/mo (Supabase + hosting + monitoring + domain)
Variable cost per user: ~$20.00/mo (AI $3.50 + Apple 30% of $50 + infra $1.50)
Break-even: ~7 paying users at $50 ARPU (revised from 4)

### AI Cost Growth Risk (NEW)

| Month | Avg few-shot examples/user | Avg prompt tokens | Cost/draft | Monthly cost/user |
|-------|--------------------------|-------------------|------------|-------------------|
| 1 | 50 | ~2K | $0.0006 | $0.90 |
| 3 | 200 | ~5K | $0.0015 | $2.25 |
| 6 | 500 | ~8K | $0.0024 | $3.60 |
| 12 | 1,000+ | ~12K | $0.0036 | $5.40 |

**Mitigation:** Implement Google AI prompt caching (reduces repeat context cost). Cap injected few-shot examples per generation to 20 (selected by relevance, not all 5,000). Age out examples older than 18 months.

---

## Risk Matrix (Revised)

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Voice accuracy stalls below 80% | Medium | Critical | Contingency decision tree (see Phase 0). Pivot to confidence-floor mode + free product if needed. |
| Apple App Store rejection | Medium (revised up) | High | Sandbox mode for reviewers. Early submission (week 14). GDPR/privacy compliance built in Phase 1. No auto-send on review responses. |
| Hostaway API changes/breaks | Medium | High | Local message cache, webhook subscriptions, offline draft mode (W3.6). Multi-PMS reduces single-vendor dependency. |
| Hostaway builds better native AI | High | Critical | **NEW risk.** Hostaway's included AI Replies is the biggest competitive threat. Differentiate on per-intent voice profiles, confidence scoring, and learning-from-writing. These are hard to replicate in a PMS-embedded tool. |
| Low initial adoption | High | Medium | Direct sales to local PMs (not just Facebook groups). 5 properties = guaranteed 1 user. Referral + affiliate programs. |
| AI cost spikes / prompt growth | Medium (revised up) | Medium | Prompt caching. Per-generation few-shot cap. Cost monitoring dashboard. Contingency: switch to cheaper model (GPT-4o Mini, Gemini 2.0 Flash Lite). |
| Competitor copies voice learning | Medium | Medium | Per-user learning data is moat. Switching cost high once trained (months of voice data). Ship fast. |
| Solo founder burnout | High | Critical | AI does the coding. Focus on product decisions. Automate everything possible. Direct sales is highest-leverage founder activity. |
| Airbnb builds native AI messaging | Medium | High | **NEW risk.** Expected ~2027. Vertical expansion (W3.4) is contingency. By month 12, need non-STR revenue stream piloted. |
| Aeve AI moves downmarket | Medium | High | **NEW risk.** Speed is the mitigation. Capture users before Aeve launches a Starter tier. If Phase 0 takes >6 weeks, lose the race. |
| GDPR/privacy complaint | Low | High | Cascading delete, retention policy, consent flow built in Phase 1 (W1.5). |

---

## Key Decisions Required

1. **Pricing model:** Per-property pricing (recommended by investor review) vs. flat tiers? Current recommendation: per-property. See W1.2.
2. **Free tier or free trial only?** Recommendation: 14-day free trial of Pro. No free tier (creates cost without revenue). Revisit if adoption is below target at month 3.
3. **Brand name for non-STR verticals:** Keep "Rental Voice" or create "VoiceDraft"? Decision can wait until Phase 3 pilot results.
4. **Multi-PMS timeline:** Phase 3 (after App Store validation). Don't build Guesty adapter until you have paying Hostaway users.
5. **Direct booking integration:** Keep inside Rental Voice for Seascape. Evaluate as standalone product at Phase 4.

---

## What This Plan Does NOT Cover

- **Guest-facing concierge** (Phase 6 in agent vision) — too early, requires autopilot maturity
- **Photo/image understanding** — deferred until core text pipeline is proven
- **Voice calls/phone integration** — different product, different market
- **International expansion** — English-first; i18n when there's demand signal
- **Investor fundraising** — bootstrapped approach; revisit if growth exceeds solo capacity

---

## Implementation Priority Stack

If you can only do one thing per week, do these in order:

1. Build confidence dashboard (W0.0) — measure before you fix
2. Consolidate detectIntent() (W0.0b) — prevent intent drift in all subsequent work
3. Fix confidence math (W0.1) — immediate impact on voice quality
4. Fix training data quality (W0.2) — compounds over time
5. Fix provider integration (W0.3) — quick win
6. Voice anchor for novel questions (W0.4) — raises worst-case floor
7. Origin tagging (W0.2 subset) — prevents training contamination
8. Start direct sales outreach (W2.5) — parallel with engineering
9. Supabase learning sync (W1.4) — protects investment in voice data
10. GDPR/privacy (W1.5) — required for App Store
11. Account system (W1.1) — prerequisite for billing
12. Stripe/RevenueCat (W1.2) — enables revenue
13. Automated tests (W1.6) — parallel with above
14. Onboarding polish (W2.2) — first impression for new users
15. Review responses (W2.3) — first upsell feature

---

## Adversarial Review Summary

This plan was stress-tested by two independent agents:

### Investor Review — Top Concerns Addressed
1. **Revenue projections too optimistic** → Modeled 7% monthly churn, reduced month-12 users from 300 → 200, MRR from $22K → $11K
2. **GTM is "Facebook groups + local network" = wishful thinking** → Primary channel changed to direct sales (5 calls/week to local PMs), with referral and affiliate programs
3. **Pricing doesn't match market** → Switched to per-property pricing model
4. **No contingency if voice accuracy stalls** → Added decision tree for <80% outcomes
5. **Onboarding friction too high (67% drop rate)** → Redesigned to 3-5 minute flow with "setup later" option
6. **ARPU compression not modeled** → Separate tier mix modeling, ARPU starts at $35 and grows

### Architect Review — Top Concerns Addressed
1. **5x detectIntent() copies** → Consolidation added as W0.0b prerequisite
2. **Zero automated tests** → W1.6 added as parallel workstream
3. **GDPR/privacy missing** → W1.5 added to Phase 1
4. **Supabase conflict resolution undefined** → Defined last-write-wins + dedup hash strategy
5. **RevenueCat scope underestimated** → Effort revised from 3-4 days to 6-8 days
6. **AI cost growth not modeled** → Token growth table added, prompt caching mitigation
7. **App Store review risks** → Sandbox mode, early submission, no auto-send on reviews
8. **Autopilot undo liability** → Renamed to "recall with notification," audit log, 100-send training period
9. **Hostaway API resilience** → W3.6 added (local cache, webhooks, offline drafts)

### Risks Accepted (Not Fully Mitigable)
- Airbnb native AI messaging (~2027): Vertical expansion is the hedge
- Aeve AI downmarket move: Speed is the only mitigation
- Solo founder capacity: AI coding is the leverage; direct sales is highest-value founder time
- Apple's 30% cut Year 1: Unavoidable; margins still healthy at 60%+
