# Test My Voice + Smart Draft Generation

**Date:** 2026-03-11
**Status:** Approved design — ready for implementation planning
**Prerequisite:** Voice accuracy fixes (origin tagging, voice anchors, Supabase sync) — shipped in c48fb13

## Context

Hostaway launched built-in AI Replies with a "Test AI" sandbox. Their approach: pick a tone from 8 presets, write manual rules, test in a sidebar chat. Generic FAQ bot — no voice learning.

Our response: a sandbox that uses the full voice learning pipeline, plus a comparison mode that doubles as a training accelerator. Every test makes the AI smarter.

Additionally, the current app auto-generates drafts for every incoming message — burning API calls on messages the user never opens. Smart draft generation fixes this.

## Feature 1: Test My Voice Sandbox

### Location

Settings > Test My Voice (`src/app/settings/test-voice.tsx`)

### Flow

1. Select property (dropdown, defaults to first)
2. Type a guest message OR tap a quick scenario chip
3. AI generates draft using full pipeline (same as real drafts)
4. User sees draft with confidence score
5. User types "How would you reply?" — their real response
6. App compares AI draft vs user response → voice match score + specific differences
7. User's response saved as `host_written` training example (opt-in, default on)

### UI Layout

**Top bar:**
- Back arrow + "Test My Voice" title
- Property selector pill (property name + thumbnail)

**Chat area (scrollable):**
- Guest message bubble (left, gray)
- AI draft card (right, teal border) with confidence % badge
- "How would you reply?" input area

**Comparison card (after user submits response):**
- Voice match percentage with progress bar
- Checklist: greeting ✓/✗, tone ✓/✗, sign-off ✓/✗, length ✓/✗
- "Save as training example" checkbox (default: checked)

**Bottom composer:**
- "Type a guest message..." input
- Quick scenario chips: Check-in, WiFi, Early arrival, Complaint, Parking, House rules

### Limits

- 10 sandbox tests per day (hardcoded for now; will become 5/day free, unlimited paid when billing exists)
- Sandbox drafts do NOT count against the daily 50-draft limit
- Sandbox drafts do NOT affect Accuracy Trend stats
- Sandbox training examples DO feed the learning pipeline as `host_written`

### Data Flow

1. Build synthetic `Conversation` from guest text + selected property's knowledge
2. Call `generateEnhancedAIResponse()` with synthetic conversation + live learning data
3. Display draft + confidence breakdown
4. On comparison: analyze greeting, tone, length, emoji, sign-off between draft and user response
5. Calculate voice match % between the two texts
6. If save checked: persist as few-shot example with `originType: 'host_written'`
7. If Supabase sync active: sync new example to cloud

### Key Technical Notes

- Reuse `generateEnhancedAIResponse()` directly — no new AI pipeline
- Synthetic conversation needs: guest message, property ID, property knowledge
- Flag sandbox drafts with `sandbox: true` to exclude from stats
- Voice comparison is client-side string analysis (no API call)
- Quick scenario chips are static strings stored in the component

## Feature 2: Smart Draft Generation

### Problem

Current behavior: every incoming guest message auto-triggers `generateEnhancedAIResponse()`. With 194 unread messages, that's 194 API calls for drafts nobody reads.

### Solution

Generate drafts on-demand when the user engages with a conversation, not when a message arrives.

### Logic

| Scenario | Behavior |
|----------|----------|
| Message arrives, conversation NOT open | No draft generated. Store message only. |
| User opens conversation with unread guest message | Auto-generate draft now |
| User already in conversation, new message arrives | Auto-generate immediately (current behavior) |
| Draft generated but conversation closed for 30+ min | Draft expires, regenerate on next open |

### Implementation

- Move draft trigger from message-received handler to conversation-open handler
- Add `lastViewedAt` timestamp to conversation state
- Draft generation call stays identical — just triggered later
- Estimated API cost reduction: ~80% (most messages are never opened)

### Migration

- No data migration needed
- Existing behavior changes immediately on deploy
- No user-facing setting required (this is strictly better UX)

## Pricing Notes (Future)

- Sandbox limit is a natural paid upgrade trigger
- Draft limits, sandbox limits, auto-pilot access, agent features all need unified pricing model
- Stripe LLM Token Billing (private preview) noted for future metered billing approach
- Full pricing brainstorm is a separate session — not blocking implementation

## Competitive Positioning

| Hostaway AI Replies | Rental Voice Test My Voice |
|--------------------|---------------------------|
| 8 preset tones | Learned from 15,000+ real messages |
| Manual rules ("don't use periods") | Auto-learned patterns (greeting, sign-off, emoji, warmth) |
| Test generates generic response | Test generates voice-matched response |
| No training from test usage | Every test improves the AI |
| No comparison mode | Side-by-side with voice match scoring |

## Implementation Order

1. Smart draft generation (quick win, saves money immediately)
2. Test My Voice screen (basic: guest input → AI draft → confidence)
3. Voice comparison mode (user response → match scoring → training)
4. Quick scenario chips (polish, low effort)
