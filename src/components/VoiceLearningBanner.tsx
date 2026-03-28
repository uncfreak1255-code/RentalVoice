import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Sparkles } from 'lucide-react-native';
import type { HostawayHistorySyncJob } from '@/lib/api-client';
import { colors, radius, spacing, typography } from '@/lib/design-tokens';

interface VoiceLearningBannerProps {
  job: HostawayHistorySyncJob | null;
}

function getBannerState(job: HostawayHistorySyncJob | null) {
  if (!job) {
    return {
      eyebrow: 'Learning your voice',
      title: 'We are preparing your first voice model',
      body: 'Drafts are available now and will improve as your past replies are imported.',
    };
  }

  if (job.status === 'failed' || job.status === 'cancelled' || job.phase === 'error') {
    return {
      eyebrow: 'Learning paused',
      title: 'Hostaway connected, but training hit a problem',
      body: job.lastError || 'Drafts are still available, but past-message training needs attention.',
    };
  }

  if (job.status === 'completed' || job.phase === 'complete') {
    return {
      eyebrow: 'Voice model ready',
      title: 'Your past replies are now grounded on the server',
      body: 'Drafts are available now, and autopilot stays off until the readiness gate is met.',
    };
  }

  if (job.phase === 'analyzing') {
    return {
      eyebrow: 'Learning your voice',
      title: 'We are turning your past replies into reusable voice patterns',
      body: 'Drafts are available now. They will keep tightening as more examples are imported.',
    };
  }

  return {
    eyebrow: 'Syncing message history',
    title: 'We are importing your Hostaway conversations',
    body: 'Drafts are available now. Autopilot stays off until the server has enough voice data.',
  };
}

export function VoiceLearningBanner({ job }: VoiceLearningBannerProps) {
  const state = getBannerState(job);

  return (
    <View style={styles.card} testID="voice-learning-banner">
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          {job?.status === 'completed' || job?.phase === 'complete' ? (
            <CheckCircle2 size={20} color={colors.primary.DEFAULT} />
          ) : (
            <Sparkles size={20} color={colors.accent.DEFAULT} />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{state.eyebrow}</Text>
          <Text style={styles.title}>{state.title}</Text>
        </View>
      </View>

      <Text style={styles.body}>{state.body}</Text>

      {job ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Status: {job.status}</Text>
          <Text style={styles.metaText}>Phase: {job.phase}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing['4'],
    marginBottom: spacing['4'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.bg.hover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.accent.DEFAULT,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
    marginBottom: 2,
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    color: colors.text.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing['3'],
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['3'],
    marginTop: spacing['3'],
  },
  metaText: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
});
