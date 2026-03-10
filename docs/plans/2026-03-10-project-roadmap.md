# Rental Voice — Project Roadmap

Last updated: 2026-03-10

## Status: Personal-mode daily driver → App Store ready

---

## Phase 0: Foundation Fixes (COMPLETED)

### AI Quality
- [x] **Origin tagging** — Messages tagged as `host_written`, `ai_edited`, `ai_approved`
- [x] **Origin-aware training weights** — host_written=3x, ai_edited=2.5x, ai_approved=1x (was: all approved=3x)
- [x] **Voice anchor** — Low-confidence drafts inject 5 diverse host-written examples as tone reference
- [x] **Origin-priority scoring** — Few-shot selection favors host_written (+30) over ai_edited (+15)

### UX Fixes
- [x] **Send button visibility** — Removed ModelPicker/attach button from input row, added flexShrink:0
- [x] **Draft auto-minimize on keyboard** — Draft card collapses to pill bar when keyboard appears
- [x] **Vertical stacking fix** — ownReplyHint only shows alongside minimized pill, not full card
- [x] **Keyboard offset** — Uses safe area insets instead of hardcoded 100

---

## Phase 1: Learning Durability (COMPLETED)

### Fix 2 — Supabase Learning Profile Sync
**Goal**: Learning data survives app resets, device changes, and reinstalls.

| Task | Priority | Status |
|------|----------|--------|
| Create `learning_profiles` table in Supabase | P0 | Done |
| Create `few_shot_examples` table in Supabase | P0 | Done |
| Build sync service (client-side) | P0 | Done |
| Hook sync into training batch completion | P0 | Done |
| Restore learning on fresh install/app reset | P0 | Done |
| Conflict resolution (local vs cloud) | P1 | Done |
| Offline queue for sync failures | P1 | Done |

### Learning Quality Improvements
| Task | Priority | Status |
|------|----------|--------|
| Learning dashboard accuracy metrics (real approval rate vs AI-inflated) | P1 | Done |
| Negative example learning from rejections | P2 | Pending |
| Per-property voice divergence detection | P2 | Pending |

---

## Phase 2: UX Polish & App Store Readiness

### Composer & Chat UX
| Task | Priority | Status |
|------|----------|--------|
| Draft card swipe-to-dismiss gesture | P1 | Pending |
| Haptic feedback on draft actions (approve/edit/reject) | P1 | Pending |
| Draft confidence visual (color gradient based on score) | P2 | Pending |
| Smooth keyboard animation (reanimated spring) | P2 | Pending |
| Message send success animation | P2 | Pending |
| Typing indicator for AI draft generation | P1 | Pending |
| Long-press message context menu (copy, favorite, report) | P2 | Pending |

### Inbox UX
| Task | Priority | Status |
|------|----------|--------|
| Pull-to-refresh with sync status indicator | P1 | Pending |
| Unread badge counts on tab bar | P1 | Pending |
| Conversation archive undo toast | P2 | Pending |
| Empty state illustrations (no conversations, no unread) | P2 | Pending |
| Swipe actions polish (archive, mark read) | P2 | Pending |

### Onboarding UX
| Task | Priority | Status |
|------|----------|--------|
| Onboarding flow redesign (Rental Voice account first) | P0 | Blocked on Phase 3 |
| Hostaway connection as second step (not identity) | P0 | Blocked on Phase 3 |
| First-sync progress screen with learning ETA | P1 | Pending |
| Onboarding skip/demo mode polish | P2 | Pending |

### Settings & Navigation
| Task | Priority | Status |
|------|----------|--------|
| Settings search (filter settings by keyword) | P2 | Pending |
| Learning progress visualization (chart/graph) | P1 | Pending |
| Property knowledge bulk import from Hostaway listing data | P1 | Pending |
| Quick actions from notification (reply without opening full chat) | P2 | Pending |

### Visual Polish
| Task | Priority | Status |
|------|----------|--------|
| Dark mode support | P1 | Pending |
| App icon refinement | P1 | Pending |
| Launch screen / splash animation | P1 | Pending |
| Consistent loading skeletons across all screens | P2 | Pending |
| Accessibility audit (VoiceOver, Dynamic Type) | P1 | Pending |

---

## Phase 3: Durable Identity & Auth

**Goal**: Replace Hostaway-credential-as-identity with Rental Voice account.

| Task | Priority | Status |
|------|----------|--------|
| Durable identity contract: RV account first, PMS connection second | P0 | Designed |
| Founder auth entry/recovery path in app | P0 | Backend ready, UI stub |
| Session detection and restoration on app reset | P0 | Pending |
| Personal-to-founder learning migration (app-triggered) | P0 | Backend route exists |
| Account-backed learning durability (cloud-first after auth) | P0 | Depends on Fix 2 |
| Founder backend surface validation from app session | P1 | Pending |
| Email/password sign-up flow (general users) | P1 | Pending |
| Apple Sign In / Google Sign In | P1 | Pending |
| Password reset flow | P1 | Pending |
| Session token refresh / silent re-auth | P1 | Pending |

---

## Phase 4: Commercial Features

**Goal**: Multi-user, server-managed, paid tiers.

| Task | Priority | Status |
|------|----------|--------|
| Commercial mode as default (cutover) | P0 | Blocked on Phase 3 |
| Server-proxied AI calls (metered) | P0 | Backend exists |
| Billing integration (Stripe) | P0 | Routes exist |
| Entitlement enforcement (draft limits, auto-pilot) | P0 | Routes exist |
| Multi-property org management | P1 | Pending |
| Team member invites | P1 | Pending |
| Usage analytics dashboard | P1 | Backend exists |
| Tiered feature gating UI | P1 | Pending |

---

## Phase 5: App Store Launch

| Task | Priority | Status |
|------|----------|--------|
| App Store screenshots (6.7", 6.1", iPad) | P0 | Pending |
| App Store description and keywords | P0 | Pending |
| Privacy policy URL | P0 | Exists |
| Support URL | P0 | Exists |
| TestFlight beta distribution | P0 | Pending |
| Crash reporting (Sentry integration) | P1 | Partially configured |
| App review submission | P0 | Pending |
| Terms of Service | P0 | Pending |

---

## Current Sprint Focus

**Completed**: Phase 0 (foundation fixes), Phase 1 (learning durability)
**Active**: Phase 2 UX polish
**Next**: Phase 3 (durable identity)
**Blocked**: Phase 4 (commercial) blocks Phase 5 (App Store)

---

## Architecture Decisions Log

| Decision | Date | Rationale |
|----------|------|-----------|
| Origin-aware training weights | 2026-03-10 | Prevent AI feedback loop where approved drafts train at same weight as host-written |
| Voice anchor injection | 2026-03-10 | Novel questions need tone reference even without historical match |
| Auto-minimize draft on keyboard | 2026-03-10 | 280px draft card + keyboard = no room for messages; pill bar is sufficient |
| Safe area insets for keyboard offset | 2026-03-10 | Hardcoded 100 breaks on non-standard screen sizes |
| Learning sync to Supabase | 2026-03-10 | Local-only learning is single point of failure; must survive app resets |
| RV account first, Hostaway second | 2026-03-09 | PMS credentials are a connection, not an identity; users need durable accounts |
