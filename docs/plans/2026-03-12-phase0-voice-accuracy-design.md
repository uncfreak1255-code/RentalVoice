# Phase 0: Voice Accuracy Foundation — Design

**Date:** 2026-03-12
**Status:** approved
**Goal:** Get median voice confidence from ~45% to 80%+

## Context

Strategic plan Phase 0 requires a measurement-first approach. Codebase audit revealed 6 of 10 originally-identified pipeline bugs were already fixed. Without instrumentation, we can't tell what's actually broken vs. what's working. The dashboard is the prerequisite for all other fixes.

### Already Fixed (do not re-implement)
- Confidence cap raised to 95% (was 85%)
- styleMatch is dynamic 40-95 (was hard-capped at 75)
- Post-gen validation has positive bonuses (was penalty-only)
- Few-shot cap raised to 5,000 (was 1,000)
- Gemini system_instruction properly separated
- Server trusts client confidence (no hardcoded 82)
- Origin tagging implemented (`host_written` / `ai_approved` / `ai_edited`)
- TemporalWeightManager wired into generation

### Remaining Work
1. **W0.0 — Confidence Dashboard** (measurement — this design)
2. **W0.0b — Consolidate detectIntent** (3 copies → 1 canonical)
3. **W0.1 — Wire MultiPassTrainer scoring** (phrases injected, confidence scoring unused)
4. **W0.2-W0.4 — Data-driven fixes** (decided after dashboard shows real baseline)

## W0.0 — Confidence Dashboard Design

### Summary Card (AI Learning screen)

Placed at the top of the existing AI Learning screen (`src/app/settings/ai-learning.tsx`), above the current content.

**Visual:**
```
┌─────────────────────────────────────┐
│  Voice Confidence          ▲ +8%    │
│  ┌──────┐                           │
│  │  62% │  median (last 50 drafts)  │
│  └──────┘                           │
│  127 drafts  •  43 host-written     │
│                         See Details >│
└─────────────────────────────────────┘
```

**Data:**
- Median confidence of last 50 drafts (big number, color-coded)
- Trend vs prior 50 drafts (arrow + percentage delta)
- Total draft count and host-written count
- Tap → navigates to detail screen

**Color coding:**
- Red: <50%
- Yellow: 50-70%
- Green: 70%+

### Detail Screen (standalone)

New route: `src/app/settings/voice-confidence.tsx`

**Sections:**

#### 1. Confidence Distribution
Horizontal bar histogram showing last 200 drafts bucketed by 10% ranges (0-10, 10-20, ... 90-100). Each bar labeled with count. Highlights the median bucket.

#### 2. Per-Intent Breakdown
Table with columns: Intent | Count | Median | Best | Worst
Sorted by count descending. Shows top 10 intents. Uses existing intent categories from `intent-detection.ts`.

#### 3. Confidence Timeline
Simple sparkline showing daily median confidence over last 30 days. One data point per day (median of that day's drafts). No axis labels needed — just the shape of the trend.

#### 4. Training Data Stats
Cards showing:
- Total learning entries (with origin breakdown: host_written / ai_approved / ai_edited)
- Few-shot pool size (of 5,000 max)
- Style profile completeness (how many intents have trained patterns)
- Last training batch timestamp

#### 5. Quick Actions
- **Export Diagnostics** — dumps full learning state as JSON to share for debugging
- **Reset Learning** — confirmation dialog, clears all learned patterns (emergency escape hatch)

### Data Source

All data from existing on-device stores via `useStore()`:
- `learningEntries` — confidence values, timestamps, intents, origin types
- `aiLearningProgress` — training counters
- `fewShotIndex` — example pool
- `hostStyleProfiles` — style profiles per intent

No new API calls. No backend work. Pure client-side computation.

### New Files
- `src/app/settings/voice-confidence.tsx` — detail screen route
- `src/components/ConfidenceDashboard.tsx` — summary card component
- `src/components/ConfidenceDetail.tsx` — detail screen component
- `src/lib/confidence-analytics.ts` — computation helpers (median, histogram, per-intent aggregation)

### Modified Files
- `src/app/settings/ai-learning.tsx` — add ConfidenceDashboard card at top

## W0.0b — Consolidate detectIntent

Three copies exist:
- `src/lib/intent-detection.ts` line 138 (canonical, exported)
- `src/lib/ai-learning.ts` line 791 (private copy)
- `src/lib/ai-service.ts` line 323 (private copy)

**Change:** Delete the two private copies. Replace all call sites with imports from `intent-detection.ts`. Verify behavior is identical (same switch/case logic) before removing.

## W0.1 — Wire MultiPassTrainer Confidence Scoring

`MultiPassTrainer.getFrequentPhrases()` is already injected into prompts. But `MultiPassTrainer` also computes confidence adjustments based on multi-pass analysis that are currently discarded.

**Change:** After the main confidence calculation in `ai-enhanced.ts`, call MultiPassTrainer's scoring method and blend its result (weighted 20%) into the final confidence. This is a small, measurable change — the dashboard will show whether it helps.

## W0.2-W0.4 — Deferred to Data

After the dashboard is live and showing real baseline numbers:
- If per-intent confidence varies wildly → investigate intent-specific training gaps
- If host_written examples are underrepresented → adjust few-shot selection priority
- If confidence plateaus despite more training → investigate prompt structure
- Voice anchor (from original plan) → implement only if novel-question confidence is measurably low

## Implementation Order

1. W0.0 (dashboard) — must be first, everything else depends on measurement
2. W0.0b (detectIntent consolidation) — quick cleanup, reduces future confusion
3. W0.1 (MultiPassTrainer scoring) — first real accuracy fix, measured by dashboard
4. W0.2-W0.4 — data-driven, decided after 1-2 weeks of dashboard data

## Success Criteria

- Dashboard shows real median confidence number
- After W0.1, median confidence increases measurably (target: 5-10% lift)
- No regressions in existing draft generation
- All changes verified on physical device via OTA
