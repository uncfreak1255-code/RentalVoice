# Rental Voice Agent — Product Vision & Roadmap

**Date:** 2026-03-10
**Status:** Vision document — NOT approved for implementation
**Prerequisite:** Voice accuracy must reach 80%+ before agent work begins

## Core Thesis

Rental Voice's differentiator is voice accuracy — the AI sounds like the specific host. The agent layer builds on that foundation to handle operations, not just messaging. Without reliable voice matching, an autonomous agent amplifies bad drafts instead of good ones.

## The Control Spectrum

Three modes that hosts graduate through as trust builds:

### Observer (default for new users)
AI watches everything, learns, and **briefs** — never acts on its own.
- Reads all incoming messages
- Drafts responses (host approves each one, like today)
- Tracks patterns: response times, common questions, pricing gaps
- Morning briefing: "Here's what happened. Here's what I *would have* done."
- **Who it's for:** Hosts who use PriceLabs, have co-hosts, or don't trust AI yet

### Copilot (current auto-pilot, extended)
AI acts on **messaging only** (high confidence), proposes everything else.
- Auto-sends messages above confidence threshold
- Proposes pricing changes, calendar blocks as action cards
- Host approves/rejects with one tap
- Morning briefing: "Here's what I did + what I'm proposing."
- **Who it's for:** Most hosts. Want AI handling 3 AM questions but approve anything touching money.

### Autopilot (premium)
AI acts within bounds the host sets.
- Everything in Copilot, plus:
- Pricing adjustments within host-set bounds (±X%, never below $Y)
- Gap-night fills, extended-stay discount offers
- Calendar blocks for maintenance
- 30-second undo window on everything
- Morning briefing: "Here's everything I did. Undo anything you disagree with."
- **Who it's for:** Power hosts, multi-property operators

### Per-Capability Controls
Each capability toggles independently:
- Messaging: [Auto / Propose / Off]
- Pricing: [Auto+Undo / Propose / Off]
- Calendar: [Auto+Undo / Propose / Off]
- Guest Offers: [Auto+Undo / Propose / Off]
- Reviews: [Positive only / All / Off]

Hosts who use PriceLabs toggle pricing to Off. The agent handles everything else.

## Architecture: AgentAction Framework

Universal unit of work the AI can propose or execute:

```
AgentAction {
  id: string
  type: 'message' | 'pricing' | 'calendar_block' | 'discount_offer' |
        'escalation' | 'review_response_pos' | 'review_response_neg' |
        'rule_enforcement' | 'proactive_guide' | 'issue_detected'
  status: 'proposed' | 'approved' | 'executing' | 'executed' | 'undone' | 'rejected'
  confidence: number
  propertyId: string
  conversationId?: string
  payload: Record<string, any>
  reasoning: string
  undoPayload?: Record<string, any>
  undoDeadline?: Date
  createdAt: Date
  executedAt?: Date
  executedBy: 'agent' | 'host'
}
```

Plugin executor system — each action type gets its own executor:

```
ActionExecutor {
  type: string
  validate(action): boolean
  execute(action): Promise<Result>
  undo(action): Promise<Result>
  describe(action): string    // for morning briefing
}
```

Adding new capabilities = adding new action types + executors. Framework stays the same.

## Feature Components

### 1. Morning Briefing
Daily digest screen — the agent's primary UI surface.

Sections:
- Overnight summary (messages handled, issues found, opportunities)
- Needs attention (action cards requiring host input)
- Handled automatically (what the agent did within its authority)
- Patterns noticed (cross-property insights)
- Agent accuracy (rolling weekly %)

Reachable from: Inbox banner, push notification, Settings > Agent > History.
No new tab needed.

### 2. Pattern Detection Engine
AI spots trends across properties and time that humans miss:
- Recurring issues: "3 guests mentioned slow WiFi at Beach House this month"
- Guest behavior: "Guests at Mountain Cabin ask about restaurants on Day 2"
- Booking patterns: "Cancellation rate spikes 2 weeks before check-in"
- Performance: "Fast responders get 40% higher review scores"

Runs as nightly batch analysis, not per-message. Surfaces in morning briefing.

### 3. Issue Intelligence
Conversation-sourced issue detection — NOT task management.

```
Issue {
  propertyId, conversationId, detectedFrom, category, severity,
  status, guestImpact, aiSummary, relatedIssues, detectedAt
}
```

Categories: plumbing, electrical, appliance, cleanliness, noise, access, wifi, hvac, pest, other.
Severity: cosmetic, functional, urgent, safety.

Deduplication: scoped to (propertyId, category, 30-day window).
Resolution: host marks resolved → AI follows up with guest.

This is NOT a task board. Rental Voice detects issues from conversations. Hosts manage tasks in Hostaway or their existing tools.

### 4. Natural Language Rules
Host types rules in plain English, AI enforces them:
- "Never let anyone check in after 10pm at the beach house"
- "Always offer 10% for stays over 5 nights"
- "If a guest mentions kids, send the family guide"
- "Don't auto-reply about the pool heater — I handle those"

V1: 5-10 structured templates covering 80% of use cases.
V2: Free-form NLP parsing.

Rules stored as structured constraints. Conflict detection when rules overlap.
Confidence threshold — if AI is <80% sure a rule applies, skip or ask host.

### 5. Review Response Agent
Positive reviews (4-5 stars): Copilot mode allowed, auto-post after 24hr window.

Negative reviews (1-3 stars): **HARDCODED to manual approval. Always. No exceptions.**
- Uses separate "public voice" profile (more measured than private messaging tone)
- Shows in compose screen, not one-tap approve
- Flags sensitivity: safety issues, factual claims, legal risk
- Requires host to read and confirm before posting

### 6. Guest Concierge (deferred)
Property-knowledge-based answers to guest factual questions.
Separate from the messaging/voice system — uses cheap models for factual Q&A.
Requires stay summaries, property knowledge verification, rate limiting.
**Build only after voice accuracy is solid and messaging pipeline is trusted.**

## Settings Screen Changes

### New section order:
1. **Your Agent** (mode selector, per-capability toggles, briefing link) — hero section
2. **Your Voice** (AI Learning + Voice Quality Dashboard merged)
3. **Auto-Pilot** (messaging confidence threshold — existing)
4. **Usage & Plan** (metering, billing, memory status)
5. **Notifications**
6. **Connection** (Hostaway setup — touch once)
7. **About**

### Voice Quality Dashboard (replace Performance & Insights):
- "Your Voice Match" % (reframed approval rate)
- Before/After draft comparison (Week 1 vs current)
- Learning velocity ("AI improved 12% this week")
- Guest satisfaction signal from post-AI positive replies

### Response Time Tracker:
- Average response time vs industry average
- Connection to Airbnb/VRBO ranking impact
- "AI is doing this for you" framing

### Remove/hide:
- Founder section → 5-tap on version number
- Memory Plan → collapse into Usage ("Memory: Active/Limited")
- Cultural Tone toggle → auto-detect, remove toggle

## Unit Economics

### Cost per interaction by model routing:
- Cheap (factual, scheduling, acknowledgments): ~$0.001 — 70-80% of interactions
- Mid (standard replies, briefings, patterns): ~$0.01 — 15-25% of interactions
- Premium (complaints, negative reviews, voice-critical): ~$0.02 — 5-10% of interactions

### Margin by host profile:
- Solo (2 properties, ~$39/mo): COGS ~$8-9, margin ~77%
- Mid (8 properties, ~$89/mo): COGS ~$20, margin ~78%
- Power (25 properties, ~$174/mo): COGS ~$58, margin ~67%

### Protections:
- Interaction caps per plan tier (soft warning at 80%, notification at 100%)
- Per-property pricing above 20 properties
- Factual answer caching (eliminates 30-40% of cheap-model calls)
- Model-agnostic architecture (can switch providers if prices change)
- Guest rate limiting (10 messages/day instant, throttle after)

### Suggested pricing:
- Starter $29/mo: 3 properties, Observer + Copilot messaging, 500 interactions
- Pro $79/mo: 10 properties, full Copilot + Autopilot messaging, concierge, patterns, 2,500 interactions
- Business $149/mo: 20 properties, all features including pricing/calendar autopilot, 8,000 interactions
- Enterprise: custom per-property pricing

## Implementation Order

**Phase 0 (NOW — prerequisite):**
Fix voice accuracy. Origin tagging (Fix 1), voice anchoring (Fix 3), Supabase learning persistence (Fix 2). Target: 80%+ Voice Match on Sawyer's profile.

**Phase 1 (after voice accuracy hits 80%):**
Morning Briefing screen. Observer mode only. No actions, just intelligence. Test on Sawyer's usage — is the daily digest actually useful?

**Phase 2 (after briefing proves useful):**
Issue Intelligence + Pattern Detection. Agent starts noticing things. Still no autonomous actions.

**Phase 3 (after patterns prove accurate):**
Settings improvements (Voice Dashboard, Response Time, section reorder). Make the trust-building metrics visible.

**Phase 4 (after trust metrics are live):**
AgentAction framework + Copilot mode for pricing/calendar. Propose actions, host approves.

**Phase 5 (after hosts trust proposals):**
Autopilot mode, Natural Language Rules, Review Response Agent. Full autonomy within bounds.

**Phase 6 (future):**
Guest Concierge, voice calls, photo understanding, multi-agent orchestration.

## Key Design Decisions

1. **Agent doesn't handle guest messages.** The existing chat + auto-pilot pipeline handles messaging. The agent handles operations.
2. **Negative review responses are never autonomous.** Hardcoded to manual approval regardless of agent mode.
3. **Issue Intelligence, not task management.** Detect issues from conversations. Don't compete with Hostaway's task features.
4. **Bounds, not rules.** Host sets constraints ("never below $150"). AI figures out optimal actions within bounds.
5. **Trust is earned.** Observer → Copilot → Autopilot. Each graduation requires demonstrated accuracy.
6. **Morning briefing is the product.** For conservative hosts, the briefing alone justifies the subscription.

## Sales Pitch This Enables

"Rental Voice learns how YOU talk to guests. In 2 weeks it matches your voice 85%+, replies in under 5 minutes, and your Airbnb response rating goes to Superhost level. Turn on the agent and it handles pricing gaps, detects maintenance issues before guests complain, and briefs you every morning on what happened overnight. You run 10 properties like they're 1."
