import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, MessageSquare, CheckCircle, Edit3, XCircle, Clock, Wrench, TrendingUp, DollarSign, Sparkles, Users, BarChart3, CalendarDays } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface AnalyticsDashboardProps { onBack: () => void; }

type TimeRange = '7d' | '30d' | '90d' | 'all';
const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'all', label: 'All Time' },
];

const { width } = Dimensions.get('window');

export function AnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const analytics = useAppStore((s) => s.analytics);
  const learningEntries = useAppStore((s) => s.learningEntries);
  const issues = useAppStore((s) => s.issues);
  const conversations = useAppStore((s) => s.conversations);

  const handleTimeRange = (range: TimeRange) => {
    Haptics.selectionAsync();
    setTimeRange(range);
  };

  const metrics = useMemo(() => {
    const totalAiResponses = analytics.aiResponsesApproved + analytics.aiResponsesEdited + analytics.aiResponsesRejected;
    const approvalRate = totalAiResponses > 0 ? Math.round((analytics.aiResponsesApproved / totalAiResponses) * 100) : 0;
    const editRate = totalAiResponses > 0 ? Math.round((analytics.aiResponsesEdited / totalAiResponses) * 100) : 0;
    const rejectionRate = totalAiResponses > 0 ? Math.round((analytics.aiResponsesRejected / totalAiResponses) * 100) : 0;
    const autonomyRate = totalAiResponses > 0 ? Math.round(((analytics.aiResponsesApproved + analytics.aiResponsesEdited) / totalAiResponses) * 100) : 0;
    const timeSavedMinutes = analytics.aiResponsesApproved * 2;
    const timeSavedHours = Math.round(timeSavedMinutes / 60 * 10) / 10;
    const avgResponseSeconds = analytics.averageResponseTime;
    const avgResponseFormatted = avgResponseSeconds < 60 ? `${Math.round(avgResponseSeconds)}s` : `${Math.round(avgResponseSeconds / 60)}m`;
    const openIssues = issues.filter((i) => i.status !== 'resolved').length;
    const activeConversations = conversations.filter((c) => c.status !== 'archived').length;
    return { totalAiResponses, approvalRate, editRate, rejectionRate, autonomyRate, timeSavedHours, avgResponseFormatted, openIssues, activeConversations };
  }, [analytics, issues, conversations]);

  const learningInsights = useMemo(() => {
    const intentCounts: Record<string, number> = {};
    const editedIntents: Record<string, number> = {};
    learningEntries.forEach((entry) => {
      const intent = entry.guestIntent || 'unknown';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
      if (entry.wasEdited) editedIntents[intent] = (editedIntents[intent] || 0) + 1;
    });
    const mostCommonIntent = Object.entries(intentCounts).sort(([, a], [, b]) => b - a)[0];
    const needsImprovementIntent = Object.entries(editedIntents).sort(([, a], [, b]) => b - a)[0];
    return {
      mostCommonIntent: mostCommonIntent ? { intent: mostCommonIntent[0], count: mostCommonIntent[1] } : null,
      needsImprovementIntent: needsImprovementIntent ? { intent: needsImprovementIntent[0], count: needsImprovementIntent[1] } : null,
      totalLearnings: learningEntries.length,
    };
  }, [learningEntries]);

  const renderStatCard = (icon: React.ReactNode, label: string, value: string | number, subtitle?: string, color: string = '#F97316') => (
    <View style={ad.statCard}>
      <View style={[ad.rowCenter, { marginBottom: spacing['2'] }]}>
        <View style={[ad.iconCircle, { backgroundColor: `${color}20` }]}>{icon}</View>
      </View>
      <Text style={ad.statValue}>{value}</Text>
      <Text style={ad.statLabel}>{label}</Text>
      {subtitle && <Text style={ad.statSub}>{subtitle}</Text>}
    </View>
  );

  const renderProgressBar = (value: number, color: string, label: string) => (
    <View style={{ marginBottom: spacing['4'] }}>
      <View style={[ad.rowBetween, { marginBottom: 4 }]}>
        <Text style={ad.muted}>{label}</Text>
        <Text style={ad.white}>{value}%</Text>
      </View>
      <View style={ad.progressTrack}>
        <View style={[ad.progressFill, { width: `${value}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );

  return (
    <View style={ad.root}>
      <LinearGradient colors={[colors.bg.elevated, colors.bg.subtle]} style={ad.gradient} />
      <SafeAreaView style={ad.flex} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={ad.header}>
          <View style={ad.rowCenter}>
            <Pressable onPress={onBack} style={({ pressed }) => [ad.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <ArrowLeft size={20} color={colors.text.primary} />
            </Pressable>
            <View>
              <Text style={ad.title}>Analytics</Text>
              <Text style={ad.headerSub}>Performance insights</Text>
            </View>
          </View>
        </Animated.View>

        <ScrollView style={ad.flex} showsVerticalScrollIndicator={false}>
          {/* Time Range Filter */}
          <Animated.View entering={FadeInDown.duration(300).delay(50)} style={ad.filterRow}>
            <CalendarDays size={14} color={colors.text.disabled} />
            {TIME_RANGE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => handleTimeRange(opt.value)}
                style={[
                  ad.filterPill,
                  timeRange === opt.value && ad.filterPillActive,
                ]}
              >
                <Text style={[
                  ad.filterPillText,
                  timeRange === opt.value && ad.filterPillTextActive,
                ]}>{opt.label}</Text>
              </Pressable>
            ))}
          </Animated.View>

          {/* Hero Stats */}
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={ad.px4}>
            <View style={ad.heroCard}>
              <View style={[ad.rowCenter, { marginBottom: spacing['4'] }]}>
                <Sparkles size={24} color="#F97316" />
                <Text style={[ad.white, { fontSize: 18, marginLeft: spacing['2'] }]}>AI Performance</Text>
              </View>
              <View style={ad.rowBetween}>
                <View>
                  <Text style={ad.heroValue}>{metrics.autonomyRate}%</Text>
                  <Text style={ad.muted}>Autonomy Rate</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={ad.heroResponseTime}>{metrics.avgResponseFormatted}</Text>
                  <Text style={ad.muted}>Avg Response</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={ad.heroTimeSaved}>{metrics.timeSavedHours}h</Text>
                  <Text style={ad.muted}>Time Saved</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Quick Stats Grid */}
          <Animated.View entering={FadeInDown.duration(300).delay(200)} style={ad.statsSection}>
            <View style={ad.statsRow}>
              {renderStatCard(<MessageSquare size={16} color="#F97316" />, 'Messages', analytics.totalMessagesHandled, undefined, '#F97316')}
              <View style={{ width: spacing['3'] }} />
              {renderStatCard(<Users size={16} color="#14B8A6" />, 'Active Chats', metrics.activeConversations, undefined, '#14B8A6')}
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(300).delay(250)} style={ad.statsSection2}>
            <View style={ad.statsRow}>
              {renderStatCard(<Wrench size={16} color="#EAB308" />, 'Open Issues', metrics.openIssues, undefined, '#EAB308')}
              <View style={{ width: spacing['3'] }} />
              {renderStatCard(<DollarSign size={16} color="#22C55E" />, 'Upsell Revenue', `$${analytics.upsellRevenue}`, `${analytics.upsellsGenerated} upsells`, '#22C55E')}
            </View>
          </Animated.View>

          {/* AI Response Breakdown */}
          <Animated.View entering={FadeInDown.duration(300).delay(300)} style={ad.sectionWrap}>
            <Text style={ad.sectionTitle}>AI Response Quality</Text>
            <View style={ad.card}>
              {renderProgressBar(metrics.approvalRate, '#22C55E', 'Approved (No Changes)')}
              {renderProgressBar(metrics.editRate, '#EAB308', 'Edited Before Send')}
              {renderProgressBar(metrics.rejectionRate, '#EF4444', 'Rejected / Regenerated')}
              <View style={ad.responseSummary}>
                <View style={ad.rowCenter}><CheckCircle size={16} color="#22C55E" /><Text style={[ad.muted, { marginLeft: spacing['2'] }]}>{analytics.aiResponsesApproved} approved</Text></View>
                <View style={ad.rowCenter}><Edit3 size={16} color="#EAB308" /><Text style={[ad.muted, { marginLeft: spacing['2'] }]}>{analytics.aiResponsesEdited} edited</Text></View>
                <View style={ad.rowCenter}><XCircle size={16} color="#EF4444" /><Text style={[ad.muted, { marginLeft: spacing['2'] }]}>{analytics.aiResponsesRejected} rejected</Text></View>
              </View>
            </View>
          </Animated.View>

          {/* Learning Insights */}
          <Animated.View entering={FadeInDown.duration(300).delay(400)} style={ad.sectionWrap}>
            <Text style={ad.sectionTitle}>Learning Insights</Text>
            <View style={ad.card}>
              <View style={[ad.rowCenter, { marginBottom: spacing['4'] }]}>
                <TrendingUp size={20} color="#14B8A6" />
                <Text style={[ad.white, { marginLeft: spacing['2'] }]}>{learningInsights.totalLearnings} Learning Data Points</Text>
              </View>
              {learningInsights.mostCommonIntent && (
                <View style={ad.insightBox}>
                  <Text style={ad.insightLabel}>Most Common Intent</Text>
                  <Text style={ad.insightValue}>{learningInsights.mostCommonIntent.intent.replace(/_/g, ' ')}</Text>
                  <Text style={ad.insightCount}>{learningInsights.mostCommonIntent.count} occurrences</Text>
                </View>
              )}
              {learningInsights.needsImprovementIntent && (
                <View style={[ad.insightBox, ad.insightBoxWarning]}>
                  <Text style={{ color: '#EAB308', fontSize: 12, marginBottom: 4 }}>Needs Improvement</Text>
                  <Text style={ad.insightValue}>{learningInsights.needsImprovementIntent.intent.replace(/_/g, ' ')}</Text>
                  <Text style={ad.insightCount}>{learningInsights.needsImprovementIntent.count} edits needed</Text>
                </View>
              )}
              {!learningInsights.mostCommonIntent && (
                <Text style={ad.emptyText}>Start approving AI responses to build learning data</Text>
              )}
            </View>
          </Animated.View>

          {/* Cost Effectiveness */}
          <Animated.View entering={FadeInDown.duration(300).delay(500)} style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['8'] }}>
            <Text style={ad.sectionTitle}>Cost Effectiveness</Text>
            <View style={ad.roiCard}>
              <View style={[ad.rowCenter, { marginBottom: spacing['4'] }]}>
                <BarChart3 size={20} color="#22C55E" />
                <Text style={[ad.white, { marginLeft: spacing['2'] }]}>ROI Summary</Text>
              </View>
              <View style={[ad.rowBetween, { marginBottom: spacing['4'] }]}>
                <View>
                  <Text style={{ fontSize: 30, fontFamily: typography.fontFamily.bold, color: '#22C55E' }}>{metrics.autonomyRate}%</Text>
                  <Text style={ad.muted}>Messages handled autonomously</Text>
                </View>
              </View>
              <View style={ad.roiBox}>
                <View style={[ad.rowBetween, { marginBottom: spacing['2'] }]}><Text style={ad.muted}>Time saved</Text><Text style={ad.white}>{metrics.timeSavedHours} hours</Text></View>
                <View style={[ad.rowBetween, { marginBottom: spacing['2'] }]}><Text style={ad.muted}>Est. cost savings</Text><Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.medium }}>${Math.round(metrics.timeSavedHours * 25)}</Text></View>
                <View style={ad.rowBetween}><Text style={ad.muted}>Upsell revenue</Text><Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.medium }}>${analytics.upsellRevenue}</Text></View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ad = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  flex: { flex: 1 },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, height: 200 },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: `${colors.bg.elevated}E6`,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  headerSub: { color: colors.text.disabled, fontSize: 12, marginTop: 2 },
  // Time range filter
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing['4'], paddingBottom: spacing['3'],
    gap: spacing['2'],
  },
  filterPill: {
    paddingHorizontal: spacing['3'], paddingVertical: spacing['1.5'],
    borderRadius: radius.full,
    backgroundColor: `${colors.bg.elevated}80`,
  },
  filterPillActive: {
    backgroundColor: `${colors.primary.DEFAULT}20`,
    borderWidth: 1, borderColor: `${colors.primary.DEFAULT}40`,
  },
  filterPillText: {
    color: colors.text.muted, fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
  filterPillTextActive: {
    color: colors.primary.DEFAULT,
    fontFamily: typography.fontFamily.semibold,
  },
  // Stat cards
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  white: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold },
  muted: { color: colors.text.muted, fontSize: 14 },
  px4: { paddingHorizontal: spacing['4'], paddingTop: spacing['2'] },
  statsSection: { paddingHorizontal: spacing['4'], paddingTop: spacing['4'] },
  statsSection2: { paddingHorizontal: spacing['4'], paddingTop: spacing['3'] },
  sectionWrap: { paddingHorizontal: spacing['4'], paddingTop: spacing['6'] },
  sectionTitle: { fontSize: 18, fontFamily: typography.fontFamily.bold, color: colors.text.primary, marginBottom: spacing['4'] },
  card: { backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius['2xl'], padding: spacing['4'] },
  heroCard: {
    backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius['2xl'],
    padding: spacing['6'], borderWidth: 1, borderColor: '#F9731620',
  },
  heroValue: { fontSize: 36, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  heroResponseTime: { fontSize: 24, fontFamily: typography.fontFamily.bold, color: '#F97316' },
  heroTimeSaved: { fontSize: 24, fontFamily: typography.fontFamily.bold, color: colors.accent.DEFAULT },
  statCard: { flex: 1, backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius.xl, padding: spacing['4'], minWidth: 150 },
  statsRow: { flexDirection: 'row' },
  statValue: { fontSize: 24, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  statLabel: { color: colors.text.muted, fontSize: 14 },
  statSub: { color: colors.text.disabled, fontSize: 12, marginTop: 4 },
  iconCircle: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 8, backgroundColor: `${colors.border.DEFAULT}50`, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },
  responseSummary: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: spacing['4'], paddingTop: spacing['4'],
    borderTopWidth: 1, borderTopColor: `${colors.border.DEFAULT}50`,
  },
  insightBox: { backgroundColor: `${colors.bg.elevated}CC`, borderRadius: radius.md, padding: spacing['3'] },
  insightBoxWarning: { backgroundColor: '#EAB30810', borderWidth: 1, borderColor: '#EAB30830', marginTop: spacing['3'] },
  insightLabel: { color: colors.text.disabled, fontSize: 12, marginBottom: 4 },
  insightValue: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, textTransform: 'capitalize' },
  insightCount: { color: colors.text.disabled, fontSize: 12 },
  emptyText: { color: colors.text.disabled, textAlign: 'center', paddingVertical: spacing['4'] },
  roiCard: { backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius.xl, padding: spacing['4'], borderWidth: 1, borderColor: '#22C55E30' },
  roiBox: { backgroundColor: `${colors.bg.elevated}80`, borderRadius: radius.md, padding: spacing['3'] },
});
