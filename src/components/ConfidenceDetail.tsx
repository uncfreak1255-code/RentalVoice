import React, { useMemo, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, Share, Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, BarChart3, Target, TrendingUp, Database, Download, Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/lib/store';
import {
  getConfidenceStats,
  getHistogram,
  getIntentBreakdown,
  getDailyConfidence,
  getTrainingDataStats,
  getConfidenceColor,
} from '@/lib/confidence-analytics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

// ── Types ──────────────────────────────────────────

interface ConfidenceDetailProps {
  onBack: () => void;
}

// ── Helpers ────────────────────────────────────────

function formatRelativeDate(date: Date | null): string {
  if (!date) return 'Never';
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function trendLabel(direction: 'up' | 'down' | 'flat', value: number): string {
  if (direction === 'flat') return 'Flat';
  const sign = direction === 'up' ? '+' : '';
  return `${sign}${value}pts`;
}

// ── Component ──────────────────────────────────────

export default function ConfidenceDetail({ onBack }: ConfidenceDetailProps) {
  const draftOutcomes = useAppStore((s) => s.draftOutcomes);
  const learningEntries = useAppStore((s) => s.learningEntries);
  const hostStyleProfiles = useAppStore((s) => s.hostStyleProfiles);
  const aiLearningProgress = useAppStore((s) => s.aiLearningProgress);
  const resetAILearning = useAppStore((s) => s.resetAILearning);

  // ── Computed analytics ─────────────────────────

  const stats = useMemo(() => getConfidenceStats(draftOutcomes), [draftOutcomes]);

  const histogram = useMemo(() => getHistogram(draftOutcomes), [draftOutcomes]);

  const maxBucketCount = useMemo(
    () => Math.max(1, ...histogram.map((b) => b.count)),
    [histogram],
  );

  const intentBreakdown = useMemo(() => getIntentBreakdown(draftOutcomes), [draftOutcomes]);

  const dailyConfidence = useMemo(() => getDailyConfidence(draftOutcomes), [draftOutcomes]);

  const hostWrittenCount = useMemo(
    () => learningEntries.filter((e) => e.originType === 'host_written').length,
    [learningEntries],
  );

  const trainingStats = useMemo(
    () => getTrainingDataStats(
      learningEntries,
      learningEntries.length,
      hostStyleProfiles,
      aiLearningProgress,
    ),
    [learningEntries, hostStyleProfiles, aiLearningProgress],
  );

  // ── Sparkline height scaling ───────────────────

  const sparklineMax = useMemo(() => {
    if (dailyConfidence.length === 0) return 100;
    return Math.max(...dailyConfidence.map((d) => d.median), 100);
  }, [dailyConfidence]);

  // ── Actions ────────────────────────────────────

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleExport = useCallback(async () => {
    const diagnosticData = {
      exportedAt: new Date().toISOString(),
      stats,
      histogram,
      intentBreakdown,
      trainingStats,
      dailyConfidence,
    };
    try {
      await Share.share({ message: JSON.stringify(diagnosticData, null, 2) });
    } catch {
      // User cancelled share
    }
  }, [stats, histogram, intentBreakdown, trainingStats, dailyConfidence]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset All Learning',
      'This will permanently delete all voice training data, style profiles, and draft history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            resetAILearning();
          },
        },
      ],
    );
  }, [resetAILearning]);

  // ── Render ─────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Voice Confidence</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Stats Summary */}
        <View style={styles.section}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Median</Text>
              <Text style={[styles.statValue, { color: getConfidenceColor(stats.median) }]}>
                {stats.count > 0 ? `${stats.median}%` : '--'}
              </Text>
              {stats.count > 0 && stats.trendDirection !== 'flat' && (
                <Text style={[
                  styles.statTrend,
                  { color: stats.trendDirection === 'up' ? colors.success.DEFAULT : colors.danger.DEFAULT },
                ]}>
                  {trendLabel(stats.trendDirection, stats.trend)}
                </Text>
              )}
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Mean</Text>
              <Text style={[styles.statValue, { color: getConfidenceColor(stats.mean) }]}>
                {stats.count > 0 ? `${stats.mean}%` : '--'}
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Drafts</Text>
              <Text style={styles.statValue}>{stats.count}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Host-Written</Text>
              <Text style={styles.statValue}>{hostWrittenCount}</Text>
            </View>
          </View>
        </View>

        {/* Section 2: Confidence Distribution */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target size={16} color={colors.text.muted} />
            <Text style={styles.sectionTitle}>Distribution</Text>
          </View>

          {histogram.map((bucket) => (
            <View key={bucket.range} style={styles.histogramRow}>
              <Text style={styles.histogramLabel}>{bucket.range}</Text>
              <View style={styles.histogramBarTrack}>
                <View
                  style={[
                    styles.histogramBar,
                    {
                      width: `${(bucket.count / maxBucketCount) * 100}%`,
                      backgroundColor: bucket.isMedianBucket
                        ? colors.accent.DEFAULT
                        : `${colors.primary.DEFAULT}33`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.histogramCount}>{bucket.count}</Text>
            </View>
          ))}
        </View>

        {/* Section 3: Per-Intent Breakdown */}
        {intentBreakdown.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BarChart3 size={16} color={colors.text.muted} />
              <Text style={styles.sectionTitle}>By Intent</Text>
            </View>

            {intentBreakdown.map((item) => (
              <View key={item.intent} style={styles.intentRow}>
                <View style={styles.intentLeft}>
                  <Text style={styles.intentName} numberOfLines={1}>
                    {item.intent}
                  </Text>
                  <Text style={styles.intentRange}>
                    {item.worst}% – {item.best}%
                  </Text>
                </View>
                <View style={styles.intentBadge}>
                  <Text style={styles.intentBadgeText}>{item.count}</Text>
                </View>
                <Text style={[styles.intentMedian, { color: getConfidenceColor(item.median) }]}>
                  {item.median}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Section 4: Sparkline — 30-Day Trend */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={16} color={colors.text.muted} />
            <Text style={styles.sectionTitle}>30-Day Trend</Text>
          </View>

          {dailyConfidence.length > 0 ? (
            <View style={styles.sparklineContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.sparklineRow}>
                  {dailyConfidence.map((day) => {
                    const barHeight = Math.max(4, (day.median / sparklineMax) * 60);
                    return (
                      <View
                        key={day.date}
                        style={[
                          styles.sparklineBar,
                          {
                            height: barHeight,
                            backgroundColor: getConfidenceColor(day.median),
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : (
            <Text style={styles.emptyText}>Not enough data</Text>
          )}
        </View>

        {/* Section 5: Training Data */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Database size={16} color={colors.text.muted} />
            <Text style={styles.sectionTitle}>Training Data</Text>
          </View>

          <View style={styles.trainingGrid}>
            <View style={styles.trainingCard}>
              <View style={[styles.trainingDot, { backgroundColor: colors.success.DEFAULT }]} />
              <Text style={styles.trainingLabel}>Host-Written</Text>
              <Text style={styles.trainingValue}>{trainingStats.hostWritten}</Text>
            </View>

            <View style={styles.trainingCard}>
              <View style={[styles.trainingDot, { backgroundColor: colors.warning.DEFAULT }]} />
              <Text style={styles.trainingLabel}>AI Approved</Text>
              <Text style={styles.trainingValue}>{trainingStats.aiApproved}</Text>
            </View>

            <View style={styles.trainingCard}>
              <View style={[styles.trainingDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.trainingLabel}>AI Edited</Text>
              <Text style={styles.trainingValue}>{trainingStats.aiEdited}</Text>
            </View>

            <View style={styles.trainingCard}>
              <View style={[styles.trainingDot, { backgroundColor: colors.text.muted }]} />
              <Text style={styles.trainingLabel}>Legacy</Text>
              <Text style={styles.trainingValue}>{trainingStats.legacy}</Text>
            </View>
          </View>

          <View style={styles.trainingMeta}>
            <View style={styles.trainingMetaRow}>
              <Text style={styles.trainingMetaLabel}>Few-shot pool</Text>
              <Text style={styles.trainingMetaValue}>
                {trainingStats.fewShotPoolSize.toLocaleString()} / 5,000
              </Text>
            </View>
            <View style={styles.trainingMetaRow}>
              <Text style={styles.trainingMetaLabel}>Profiled intents</Text>
              <Text style={styles.trainingMetaValue}>{trainingStats.profiledIntents}</Text>
            </View>
            <View style={styles.trainingMetaRow}>
              <Text style={styles.trainingMetaLabel}>Last trained</Text>
              <Text style={styles.trainingMetaValue}>
                {formatRelativeDate(trainingStats.lastTrainingDate)}
              </Text>
            </View>
          </View>
        </View>

        {/* Section 6: Quick Actions */}
        <View style={styles.section}>
          <Pressable style={styles.actionButton} onPress={handleExport}>
            <Download size={18} color={colors.primary.DEFAULT} />
            <Text style={styles.actionButtonText}>Export Diagnostics</Text>
          </Pressable>

          <Pressable style={[styles.actionButton, styles.actionButtonDanger]} onPress={handleReset}>
            <Trash2 size={18} color={colors.danger.DEFAULT} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
              Reset Learning
            </Text>
          </Pressable>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.styles.h3,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['4'],
  },

  // Sections
  section: {
    marginBottom: spacing['6'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
    marginBottom: spacing['3'],
  },
  sectionTitle: {
    ...typography.styles.label,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Stats Summary
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['3'],
  },
  statCard: {
    flex: 1,
    minWidth: '45%' as unknown as number,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    padding: spacing['4'],
    alignItems: 'center',
  },
  statLabel: {
    ...typography.styles.caption,
    color: colors.text.muted,
    marginBottom: spacing['1'],
  },
  statValue: {
    ...typography.styles.h2,
    color: colors.text.primary,
  },
  statTrend: {
    ...typography.styles.caption,
    marginTop: spacing['1'],
  },

  // Histogram
  histogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['1.5'],
  },
  histogramLabel: {
    ...typography.styles.caption,
    color: colors.text.muted,
    width: 50,
    textAlign: 'right',
    marginRight: spacing['2'],
  },
  histogramBarTrack: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  histogramBar: {
    height: 24,
    borderRadius: 4,
    minWidth: 2,
  },
  histogramCount: {
    ...typography.styles.caption,
    color: colors.text.muted,
    width: 30,
    textAlign: 'right',
    marginLeft: spacing['2'],
  },

  // Intent Breakdown
  intentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing['2.5'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  intentLeft: {
    flex: 1,
    marginRight: spacing['2'],
  },
  intentName: {
    ...typography.styles.bodySm,
    color: colors.text.primary,
  },
  intentRange: {
    ...typography.styles.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  intentBadge: {
    backgroundColor: colors.bg.hover,
    borderRadius: radius.sm,
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['0.5'],
    marginRight: spacing['3'],
  },
  intentBadgeText: {
    ...typography.styles.caption,
    color: colors.text.muted,
  },
  intentMedian: {
    ...typography.styles.bodySm,
    width: 44,
    textAlign: 'right',
    fontFamily: typography.fontFamily.semibold,
  },

  // Sparkline
  sparklineContainer: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    padding: spacing['4'],
  },
  sparklineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    minHeight: 64,
  },
  sparklineBar: {
    width: 6,
    borderRadius: 3,
  },
  emptyText: {
    ...typography.styles.bodySm,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing['6'],
  },

  // Training Data
  trainingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['2'],
    marginBottom: spacing['3'],
  },
  trainingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    gap: spacing['2'],
    minWidth: '45%' as unknown as number,
    flex: 1,
  },
  trainingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trainingLabel: {
    ...typography.styles.caption,
    color: colors.text.muted,
    flex: 1,
  },
  trainingValue: {
    ...typography.styles.bodySm,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.semibold,
  },
  trainingMeta: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    padding: spacing['3'],
    gap: spacing['2'],
  },
  trainingMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trainingMetaLabel: {
    ...typography.styles.caption,
    color: colors.text.muted,
  },
  trainingMetaValue: {
    ...typography.styles.bodySm,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
  },

  // Quick Actions
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingVertical: spacing['3'],
    marginBottom: spacing['2'],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  actionButtonText: {
    ...typography.styles.bodySmMedium,
    color: colors.primary.DEFAULT,
  },
  actionButtonDanger: {
    borderColor: colors.danger.muted,
  },
  actionButtonTextDanger: {
    color: colors.danger.DEFAULT,
  },

  bottomPad: {
    height: spacing['10'],
  },
});
