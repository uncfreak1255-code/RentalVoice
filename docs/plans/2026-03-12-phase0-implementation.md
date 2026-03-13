# Phase 0: Voice Accuracy Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build confidence measurement dashboard, consolidate detectIntent, and wire MultiPassTrainer scoring so voice accuracy improvements are measurable.

**Architecture:** Pure client-side analytics over existing Zustand stores (`draftOutcomes`, `learningEntries`, `hostStyleProfiles`). New analytics lib computes stats, new components render them. No backend changes.

**Tech Stack:** React Native, Expo Router, Zustand, Lucide icons, design-tokens system (colors, spacing, typography, radius from `src/lib/design-tokens.ts`)

---

## Task 1: Create confidence analytics library

**Files:**
- Create: `src/lib/confidence-analytics.ts`

**Context:** `DraftOutcome` (store.ts:219-227) has `confidence?: number`, `guestIntent?: string`, `timestamp: Date`, `outcomeType: DraftOutcomeType`. Capped at 500 entries. `LearningEntry` (store.ts:146-157) has `originType?: MessageOriginType` where `MessageOriginType = 'host_written' | 'ai_approved' | 'ai_edited'`.

**Step 1: Create the analytics module**

```typescript
// src/lib/confidence-analytics.ts
import type { DraftOutcome, LearningEntry, HostStyleProfile } from './store';

export interface ConfidenceStats {
  median: number;
  mean: number;
  count: number;
  trend: number; // delta vs prior window
  trendDirection: 'up' | 'down' | 'flat';
}

export interface HistogramBucket {
  range: string; // "50-60"
  min: number;
  max: number;
  count: number;
  isMedianBucket: boolean;
}

export interface IntentBreakdown {
  intent: string;
  count: number;
  median: number;
  best: number;
  worst: number;
}

export interface TrainingDataStats {
  totalEntries: number;
  hostWritten: number;
  aiApproved: number;
  aiEdited: number;
  legacy: number; // originType undefined
  fewShotPoolSize: number;
  profiledIntents: number;
  lastTrainingDate: Date | null;
}

export interface DailyConfidence {
  date: string; // YYYY-MM-DD
  median: number;
  count: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function getConfidenceStats(outcomes: DraftOutcome[], windowSize = 50): ConfidenceStats {
  const withConfidence = outcomes
    .filter((o) => o.confidence != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const recent = withConfidence.slice(-windowSize);
  const prior = withConfidence.slice(-windowSize * 2, -windowSize);

  const recentValues = recent.map((o) => o.confidence!);
  const priorValues = prior.map((o) => o.confidence!);

  const recentMedian = median(recentValues);
  const priorMedian = median(priorValues);
  const trend = priorValues.length > 0 ? recentMedian - priorMedian : 0;

  return {
    median: Math.round(recentMedian),
    mean: recentValues.length > 0
      ? Math.round(recentValues.reduce((a, b) => a + b, 0) / recentValues.length)
      : 0,
    count: recentValues.length,
    trend: Math.round(trend),
    trendDirection: Math.abs(trend) < 2 ? 'flat' : trend > 0 ? 'up' : 'down',
  };
}

export function getHistogram(outcomes: DraftOutcome[], lastN = 200): HistogramBucket[] {
  const withConfidence = outcomes
    .filter((o) => o.confidence != null)
    .slice(-lastN);

  const values = withConfidence.map((o) => o.confidence!);
  const med = median(values);

  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < 100; i += 10) {
    const max = i + 10;
    const count = values.filter((v) => v >= i && v < max).length;
    buckets.push({
      range: `${i}-${max}`,
      min: i,
      max,
      count,
      isMedianBucket: med >= i && med < max,
    });
  }
  return buckets;
}

export function getIntentBreakdown(outcomes: DraftOutcome[], lastN = 200): IntentBreakdown[] {
  const recent = outcomes
    .filter((o) => o.confidence != null && o.guestIntent)
    .slice(-lastN);

  const byIntent = new Map<string, number[]>();
  for (const o of recent) {
    const intent = o.guestIntent!;
    if (!byIntent.has(intent)) byIntent.set(intent, []);
    byIntent.get(intent)!.push(o.confidence!);
  }

  return Array.from(byIntent.entries())
    .map(([intent, values]) => ({
      intent,
      count: values.length,
      median: Math.round(median(values)),
      best: Math.round(Math.max(...values)),
      worst: Math.round(Math.min(...values)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function getDailyConfidence(outcomes: DraftOutcome[], days = 30): DailyConfidence[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const recent = outcomes.filter(
    (o) => o.confidence != null && new Date(o.timestamp) >= cutoff
  );

  const byDay = new Map<string, number[]>();
  for (const o of recent) {
    const day = new Date(o.timestamp).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(o.confidence!);
  }

  return Array.from(byDay.entries())
    .map(([date, values]) => ({
      date,
      median: Math.round(median(values)),
      count: values.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getTrainingDataStats(
  entries: LearningEntry[],
  fewShotPoolSize: number,
  profiles: Record<string, HostStyleProfile>,
  progress: { lastTrainingDate?: Date } | null,
): TrainingDataStats {
  return {
    totalEntries: entries.length,
    hostWritten: entries.filter((e) => e.originType === 'host_written').length,
    aiApproved: entries.filter((e) => e.originType === 'ai_approved').length,
    aiEdited: entries.filter((e) => e.originType === 'ai_edited').length,
    legacy: entries.filter((e) => !e.originType).length,
    fewShotPoolSize,
    profiledIntents: Object.keys(profiles).filter((k) => k !== 'global').length,
    lastTrainingDate: progress?.lastTrainingDate
      ? new Date(progress.lastTrainingDate)
      : null,
  };
}

export function getConfidenceColor(value: number): string {
  if (value < 50) return '#EF4444'; // danger red
  if (value < 70) return '#EAB308'; // warning yellow
  return '#22C55E'; // success green
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/lib/confidence-analytics.ts 2>&1 | head -20`

If type errors, fix the imports (store types may need adjustment).

**Step 3: Commit**

```bash
git add src/lib/confidence-analytics.ts
git commit -m "feat: add confidence analytics computation library"
```

---

## Task 2: Build the summary card component

**Files:**
- Create: `src/components/ConfidenceDashboard.tsx`

**Context:** This is a card that sits at the top of the AI Learning screen. It shows median confidence, trend, and draft/training counts. Tapping navigates to the detail screen. Follow the design system: `colors`, `spacing`, `typography`, `radius` from `src/lib/design-tokens.ts`. Use Lucide icons (`TrendingUp`, `TrendingDown`, `Minus`, `ChevronRight`).

**Step 1: Create the component**

```typescript
// src/components/ConfidenceDashboard.tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus, ChevronRight, Activity } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../lib/store';
import { getConfidenceStats, getConfidenceColor } from '../lib/confidence-analytics';
import { colors, spacing, typography, radius } from '../lib/design-tokens';

interface ConfidenceDashboardProps {
  onPress: () => void;
}

export function ConfidenceDashboard({ onPress }: ConfidenceDashboardProps) {
  const draftOutcomes = useAppStore((s) => s.draftOutcomes);
  const learningEntries = useAppStore((s) => s.learningEntries);

  const stats = useMemo(() => getConfidenceStats(draftOutcomes), [draftOutcomes]);
  const hostWrittenCount = useMemo(
    () => learningEntries.filter((e) => e.originType === 'host_written').length,
    [learningEntries],
  );

  const TrendIcon = stats.trendDirection === 'up'
    ? TrendingUp
    : stats.trendDirection === 'down'
      ? TrendingDown
      : Minus;

  const trendColor = stats.trendDirection === 'up'
    ? colors.success.DEFAULT
    : stats.trendDirection === 'down'
      ? colors.danger.DEFAULT
      : colors.text.muted;

  if (stats.count === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyState}>
          <Activity size={24} color={colors.text.muted} />
          <Text style={styles.emptyText}>
            Send some AI drafts to start tracking voice confidence
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Voice Confidence</Text>
        <View style={styles.trendBadge}>
          <TrendIcon size={14} color={trendColor} />
          {stats.trend !== 0 && (
            <Text style={[styles.trendText, { color: trendColor }]}>
              {stats.trend > 0 ? '+' : ''}{stats.trend}%
            </Text>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <View style={[styles.scoreBubble, { backgroundColor: getConfidenceColor(stats.median) + '15' }]}>
          <Text style={[styles.scoreNumber, { color: getConfidenceColor(stats.median) }]}>
            {stats.median}%
          </Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaLabel}>median (last {stats.count} drafts)</Text>
          <Text style={styles.metaSub}>
            {draftOutcomes.length} total drafts  ·  {hostWrittenCount} host-written
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.detailsLink}>See Details</Text>
        <ChevronRight size={16} color={colors.text.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing['4'],
    marginHorizontal: spacing['4'],
    marginBottom: spacing['3'],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cardPressed: {
    backgroundColor: colors.bg.hover,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['3'],
  },
  title: {
    ...typography.styles.h3,
    color: colors.text.primary,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1'],
  },
  trendText: {
    ...typography.styles.label,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    marginBottom: spacing['3'],
  },
  scoreBubble: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    ...typography.styles.displayMd,
  },
  meta: {
    flex: 1,
    gap: spacing['1'],
  },
  metaLabel: {
    ...typography.styles.bodySm,
    color: colors.text.secondary,
  },
  metaSub: {
    ...typography.styles.caption,
    color: colors.text.muted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing['0.5'],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing['2'],
  },
  detailsLink: {
    ...typography.styles.label,
    color: colors.text.muted,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    padding: spacing['2'],
  },
  emptyText: {
    ...typography.styles.bodySm,
    color: colors.text.muted,
    flex: 1,
  },
});
```

**Step 2: Commit**

```bash
git add src/components/ConfidenceDashboard.tsx
git commit -m "feat: add ConfidenceDashboard summary card component"
```

---

## Task 3: Build the detail screen component

**Files:**
- Create: `src/components/ConfidenceDetail.tsx`

**Context:** Full detail screen with histogram, per-intent table, sparkline, training stats, and quick actions. Follow `TestVoiceScreen.tsx` patterns: `SafeAreaView` + `ScrollView`, `onBack` prop, Lucide icons, design-tokens styles. No charting library — render histogram and sparkline with plain Views (colored bars with width proportional to value).

**Step 1: Create the detail component**

This is the largest component. Key sections:

1. **Header** — Back button + title (same pattern as TestVoiceScreen)
2. **Stats summary** — 4 stat cards (median, mean, total drafts, host-written)
3. **Histogram** — Horizontal bar chart using `View` elements with dynamic width
4. **Intent table** — FlatList of intent rows
5. **Sparkline** — Row of dots/bars showing daily median
6. **Training stats** — Origin breakdown cards
7. **Quick actions** — Export diagnostics, Reset learning

The component should:
- Use `useAppStore` selectors for `draftOutcomes`, `learningEntries`, `hostStyleProfiles`, `aiLearningProgress`
- Use `useMemo` for all computations (these are pure functions over store data)
- Support `onBack: () => void` prop
- Use `Share.share()` for Export Diagnostics (JSON string)
- Use `Alert.alert()` confirmation for Reset Learning, then call `useAppStore.getState().resetAILearning()`

**Step 2: Implement the full component**

Write the complete component with all 7 sections. Reference:
- `getHistogram()` from confidence-analytics for the bar chart data
- `getIntentBreakdown()` for the intent table
- `getDailyConfidence()` for the sparkline
- `getTrainingDataStats()` for the stats cards
- `getConfidenceColor()` for color-coding values

Histogram bars: max width = container width * (bucket.count / maxBucketCount). Use `colors.primary.DEFAULT` for regular buckets, `colors.accent.DEFAULT` for the median bucket.

Sparkline: Row of small circles (8px) or thin vertical bars, one per day. Height proportional to confidence. Color from `getConfidenceColor()`.

**Step 3: Commit**

```bash
git add src/components/ConfidenceDetail.tsx
git commit -m "feat: add ConfidenceDetail screen with histogram, intent breakdown, sparkline"
```

---

## Task 4: Wire routes and navigation

**Files:**
- Create: `src/app/settings/voice-confidence.tsx`
- Modify: `src/app/settings/ai-learning.tsx`
- Modify: `src/components/AILearningScreen.tsx` — add ConfidenceDashboard card at top of ScrollView

**Step 1: Create the route file**

```typescript
// src/app/settings/voice-confidence.tsx
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ConfidenceDetail } from '../../components/ConfidenceDetail';
import { colors } from '../../lib/design-tokens';

export default function VoiceConfidenceScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.base }}>
      <ConfidenceDetail onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}
```

**Step 2: Add ConfidenceDashboard to AILearningScreen**

In `src/components/AILearningScreen.tsx`:
- Import `ConfidenceDashboard` and `useRouter`
- Add `const router = useRouter()` if not already present
- Insert `<ConfidenceDashboard onPress={() => router.push('/settings/voice-confidence')} />` at the top of the ScrollView content, before the existing first section

Look for the `<ScrollView` in AILearningScreen and add the card as the first child inside it.

**Step 3: Verify navigation works**

Run in simulator:
1. Open Settings → AI Learning
2. Verify ConfidenceDashboard card appears at top
3. Tap card → should navigate to voice-confidence detail screen
4. Back button → returns to AI Learning

**Step 4: Commit**

```bash
git add src/app/settings/voice-confidence.tsx src/components/AILearningScreen.tsx
git commit -m "feat: wire confidence dashboard route and navigation"
```

---

## Task 5: Consolidate detectIntent (W0.0b)

**Files:**
- Modify: `src/lib/ai-learning.ts` (line ~791 — delete private detectIntent)
- Modify: `src/lib/ai-service.ts` (line ~323 — delete private detectIntent)
- Modify: Both files — add `import { detectIntent } from './intent-detection'`

**Step 1: Compare the three implementations**

Read the private copies in ai-learning.ts:791 and ai-service.ts:323. Compare with the canonical version in intent-detection.ts:138. Document any differences in logic, return types, or intent categories.

**Step 2: Replace ai-learning.ts copy**

- Delete the private `detectIntent` function (and any private helper types it uses that aren't used elsewhere)
- Add `import { detectIntent } from './intent-detection'` at the top
- Search for all call sites of the deleted function within ai-learning.ts and verify they match the canonical signature

**Step 3: Replace ai-service.ts copy**

Same as Step 2 but for ai-service.ts.

**Step 4: Verify no regressions**

Run: `npx tsc --noEmit 2>&1 | head -30`

If type errors appear, the return types may differ slightly. Adjust the canonical `detectIntent` in intent-detection.ts to be a superset of what all three callers expect, or add a thin adapter.

**Step 5: Commit**

```bash
git add src/lib/ai-learning.ts src/lib/ai-service.ts src/lib/intent-detection.ts
git commit -m "refactor: consolidate 3 detectIntent copies into single canonical export"
```

---

## Task 6: Wire MultiPassTrainer confidence scoring (W0.1)

**Files:**
- Modify: `src/lib/ai-enhanced.ts` (around line 2091, after confidence cap)
- Modify: `src/lib/advanced-training.ts` (MultiPassTrainer class, around line 233)

**Step 1: Understand MultiPassTrainer's existing scoring**

Read the MultiPassTrainer class in advanced-training.ts. Look for:
- `results.style_tone` — may contain style alignment score
- `results.phrase_mining` — contains `frequentPhrasesList` (already used)
- `results.contextual` — may contain contextual relevance scores
- Any method that returns a numeric score or adjustment

If no explicit scoring method exists, create one:

```typescript
// In MultiPassTrainer class
getConfidenceAdjustment(): number {
  const results = this.state.results;
  if (!results || Object.keys(results).length === 0) return 0;

  let adjustment = 0;

  // Phrase mining: if we have frequent phrases, slight confidence boost
  const phrases = results.phrase_mining?.frequentPhrasesList || [];
  if (phrases.length >= 10) adjustment += 3;
  if (phrases.length >= 25) adjustment += 2; // total +5

  // Style tone: if deep training completed, boost
  if (results.style_tone?.completed) adjustment += 3;

  // Intent mapping: if intents are well-covered, boost
  if (results.intent_mapping?.completed) adjustment += 2;

  return Math.min(adjustment, 10); // cap at +10
}
```

**Step 2: Wire into confidence calculation**

In `ai-enhanced.ts`, after the confidence cap (line ~2091-2095):

```typescript
// MULTI-PASS TRAINING: Apply confidence adjustment from deep training
try {
  const multiPassAdjustment = multiPassTrainer.getConfidenceAdjustment();
  if (multiPassAdjustment > 0) {
    confidence.overall = Math.min(95, confidence.overall + multiPassAdjustment);
    console.log(`[AI Enhanced] MultiPass confidence adjustment: +${multiPassAdjustment} → ${confidence.overall}`);
  }
} catch (e) {
  console.warn('[AI Enhanced] MultiPass confidence adjustment failed:', e);
}
```

**Step 3: Verify it compiles and doesn't break generation**

Run: `npx tsc --noEmit 2>&1 | head -20`

Test in simulator: generate a draft, check console for the MultiPass log line.

**Step 4: Commit**

```bash
git add src/lib/ai-enhanced.ts src/lib/advanced-training.ts
git commit -m "feat: wire MultiPassTrainer confidence scoring into draft generation"
```

---

## Task 7: Push OTA update and verify on device

**Step 1: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors (or only pre-existing warnings)

**Step 2: Push OTA**

Run: `npx eas update --branch preview --message "Phase 0: confidence dashboard + detectIntent consolidation + MultiPass scoring"`

**Step 3: Verify on physical device**

After OTA arrives (force-quit app, reopen):
1. Settings → AI Learning → verify ConfidenceDashboard card visible
2. Tap card → verify detail screen loads with histogram, intent table, sparkline
3. Send a test AI draft → verify confidence value appears in dashboard
4. Check console logs for `[AI Enhanced] MultiPass confidence adjustment` line

**Step 4: Final commit with any fixes**

If any device-specific fixes needed, commit them:
```bash
git commit -m "fix: Phase 0 device verification fixes"
```

---

## Verification Checklist

- [ ] `confidence-analytics.ts` compiles with no type errors
- [ ] ConfidenceDashboard card renders in AI Learning screen
- [ ] Tapping card navigates to detail screen
- [ ] Detail screen shows histogram, intent table, sparkline, training stats
- [ ] Export Diagnostics produces valid JSON via Share sheet
- [ ] Only one `detectIntent` function exists (grep confirms no duplicates)
- [ ] MultiPass adjustment log line appears in console during draft generation
- [ ] OTA update pushed and verified on physical device
