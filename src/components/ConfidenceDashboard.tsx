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
