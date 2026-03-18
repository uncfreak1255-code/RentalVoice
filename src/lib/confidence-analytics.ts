// confidence-analytics.ts — Pure computation over store data for confidence dashboard
import type { DraftOutcome, LearningEntry, HostStyleProfile, AILearningProgress } from './store';

export interface ConfidenceStats {
  median: number;
  mean: number;
  count: number;
  trend: number;
  trendDirection: 'up' | 'down' | 'flat';
}

export interface HistogramBucket {
  range: string;
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
  legacy: number;
  fewShotPoolSize: number;
  profiledIntents: number;
  lastTrainingDate: Date | null;
}

export interface DailyConfidence {
  date: string;
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
    (o) => o.confidence != null && new Date(o.timestamp) >= cutoff,
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
  progress: AILearningProgress | null,
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
  if (value < 50) return '#EF4444';
  if (value < 70) return '#EAB308';
  return '#22C55E';
}
