import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Home, Smile, Meh, Frown, AlertTriangle, Zap, Heart, BarChart3, PieChart, Calendar } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/lib/store';
import { calculateSentimentStats, calculatePropertySentimentStats, calculateSentimentTrends, getSentimentPercentages, SENTIMENT_COLORS, SENTIMENT_LABELS, type SentimentStats, type SentimentType } from '@/lib/sentiment-analysis';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface SentimentTrendsDashboardProps { onBack: () => void; }

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function SimpleBarChart({ data, height = 120 }: { data: { date: string; positive: number; negative: number; neutral: number }[]; height?: number }) {
  const maxValue = Math.max(...data.flatMap(d => [d.positive, d.negative, d.neutral]), 1);
  return (
    <View style={[st.rowCenter, { alignItems: 'flex-end', justifyContent: 'space-between', height }]}>
      {data.map((item) => {
        const positiveHeight = (item.positive / maxValue) * height * 0.8;
        const negativeHeight = (item.negative / maxValue) * height * 0.8;
        return (
          <View key={item.date} style={{ alignItems: 'center', flex: 1 }}>
            <View style={[st.rowCenter, { alignItems: 'flex-end', height: '100%' }]}>
              <View style={{ width: 8, height: Math.max(4, positiveHeight), backgroundColor: '#34D399', borderTopLeftRadius: 4, borderTopRightRadius: 4, marginHorizontal: 1 }} />
              <View style={{ width: 8, height: Math.max(4, negativeHeight), backgroundColor: '#EF4444', borderTopLeftRadius: 4, borderTopRightRadius: 4, marginHorizontal: 1 }} />
            </View>
            <Text style={{ color: colors.text.disabled, fontSize: 9, marginTop: 4 }}>{item.date.split('-').slice(1).join('/')}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SentimentDistribution({ stats }: { stats: SentimentStats }) {
  const percentages = getSentimentPercentages(stats);
  const segments: { type: SentimentType; percent: number; color: string }[] = ([
    { type: 'positive' as const, percent: percentages.positive, color: '#34D399' },
    { type: 'excited' as const, percent: percentages.excited, color: '#A78BFA' },
    { type: 'neutral' as const, percent: percentages.neutral, color: '#94A3B8' },
    { type: 'negative' as const, percent: percentages.negative, color: '#F87171' },
    { type: 'frustrated' as const, percent: percentages.frustrated, color: '#FB923C' },
    { type: 'urgent' as const, percent: percentages.urgent, color: '#FB7185' },
  ]).filter(s => s.percent > 0);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {segments.map(segment => (
        <View key={segment.type} style={[st.rowCenter, { marginRight: spacing['4'], marginBottom: spacing['2'] }]}>
          <View style={{ width: 12, height: 12, borderRadius: 6, marginRight: 6, backgroundColor: segment.color }} />
          <Text style={{ color: colors.text.secondary, fontSize: 14 }}>{SENTIMENT_LABELS[segment.type]}</Text>
          <Text style={{ color: colors.text.disabled, fontSize: 14, marginLeft: 4 }}>{segment.percent}%</Text>
        </View>
      ))}
    </View>
  );
}

function SentimentIcon({ type, size = 16 }: { type: SentimentType; size?: number }) {
  const color = SENTIMENT_COLORS[type].icon;
  switch (type) {
    case 'positive': return <Smile size={size} color={color} />;
    case 'excited': return <Heart size={size} color={color} />;
    case 'neutral': return <Meh size={size} color={color} />;
    case 'negative': return <Frown size={size} color={color} />;
    case 'frustrated': return <AlertTriangle size={size} color={color} />;
    case 'urgent': return <Zap size={size} color={color} />;
    default: return <Meh size={size} color={color} />;
  }
}

function TrendIndicator({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  if (trend === 'improving') return <View style={[st.trendBadge, { backgroundColor: '#34D39920' }]}><TrendingUp size={12} color="#34D399" /><Text style={{ color: '#34D399', fontSize: 12, marginLeft: 4 }}>Improving</Text></View>;
  if (trend === 'declining') return <View style={[st.trendBadge, { backgroundColor: '#F8717120' }]}><TrendingDown size={12} color="#F87171" /><Text style={{ color: '#F87171', fontSize: 12, marginLeft: 4 }}>Declining</Text></View>;
  return <View style={[st.trendBadge, { backgroundColor: '#94A3B820' }]}><Minus size={12} color="#94A3B8" /><Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 4 }}>Stable</Text></View>;
}

export function SentimentTrendsDashboard({ onBack }: SentimentTrendsDashboardProps) {
  const conversations = useAppStore(s => s.conversations);
  const properties = useAppStore(s => s.properties);
  const [selectedTimeframe, setSelectedTimeframe] = useState<7 | 14 | 30>(7);

  const overallStats = useMemo(() => calculateSentimentStats(conversations), [conversations]);
  const propertyStats = useMemo(() => calculatePropertySentimentStats(conversations), [conversations]);
  const trends = useMemo(() => calculateSentimentTrends(conversations, selectedTimeframe), [conversations, selectedTimeframe]);

  const overallTrend = useMemo(() => {
    if (trends.length < 2) return 'stable' as const;
    const firstHalf = trends.slice(0, Math.floor(trends.length / 2));
    const secondHalf = trends.slice(Math.floor(trends.length / 2));
    const firstAvg = firstHalf.reduce((sum, t) => sum + (t.positive - t.negative), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, t) => sum + (t.positive - t.negative), 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 5) return 'improving' as const;
    if (diff < -5) return 'declining' as const;
    return 'stable' as const;
  }, [trends]);

  const percentages = getSentimentPercentages(overallStats);
  const positiveRate = percentages.positive + percentages.excited;
  const negativeRate = percentages.negative + percentages.frustrated + percentages.urgent;
  const timeframes = [{ value: 7, label: '7 Days' }, { value: 14, label: '14 Days' }, { value: 30, label: '30 Days' }];

  return (
    <View style={st.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={[st.rowCenter, { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] }]}>
          <Pressable onPress={onBack} style={({ pressed }) => [st.backBtn, { opacity: pressed ? 0.7 : 1 }]}><ArrowLeft size={20} color={colors.text.primary} /></Pressable>
          <View style={{ flex: 1 }}><Text style={st.title}>Sentiment Trends</Text><Text style={{ color: colors.text.muted, fontSize: 14 }}>Guest sentiment analysis</Text></View>
          <BarChart3 size={20} color="#14B8A6" />
        </Animated.View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Overview Cards */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ paddingHorizontal: spacing['4'], marginBottom: spacing['6'] }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={[st.overviewCard, { backgroundColor: '#34D39920', marginRight: spacing['2'] }]}>
                <View style={[st.rowCenter, { marginBottom: spacing['2'] }]}><Smile size={20} color="#34D399" /><Text style={{ color: '#34D399', fontSize: 14, fontFamily: typography.fontFamily.medium, marginLeft: spacing['2'] }}>Positive</Text></View>
                <Text style={{ color: colors.text.primary, fontSize: 30, fontFamily: typography.fontFamily.bold }}>{positiveRate}%</Text>
                <Text style={{ color: '#34D39970', fontSize: 12, marginTop: 4 }}>{overallStats.positive + overallStats.excited} conversations</Text>
              </View>
              <View style={[st.overviewCard, { backgroundColor: '#F8717120', marginLeft: spacing['2'] }]}>
                <View style={[st.rowCenter, { marginBottom: spacing['2'] }]}><Frown size={20} color="#F87171" /><Text style={{ color: '#F87171', fontSize: 14, fontFamily: typography.fontFamily.medium, marginLeft: spacing['2'] }}>Needs Attention</Text></View>
                <Text style={{ color: colors.text.primary, fontSize: 30, fontFamily: typography.fontFamily.bold }}>{negativeRate}%</Text>
                <Text style={{ color: '#F8717170', fontSize: 12, marginTop: 4 }}>{overallStats.negative + overallStats.frustrated + overallStats.urgent} conversations</Text>
              </View>
            </View>
          </Animated.View>

          {/* Overall Trend */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ paddingHorizontal: spacing['4'], marginBottom: spacing['6'] }}>
            <View style={st.card}>
              <View style={[st.rowBetween, { marginBottom: spacing['4'] }]}><Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 18 }}>Overall Trend</Text><TrendIndicator trend={overallTrend} /></View>
              {/* Timeframe Selector */}
              <View style={[st.rowCenter, { backgroundColor: colors.border.DEFAULT, borderRadius: radius.lg, padding: 4, marginBottom: spacing['4'] }]}>
                {timeframes.map(tf => (
                  <Pressable key={tf.value} onPress={() => { Haptics.selectionAsync(); setSelectedTimeframe(tf.value as 7 | 14 | 30); }} style={[st.timeTab, selectedTimeframe === tf.value && { backgroundColor: colors.bg.hover }]}>
                    <Text style={{ textAlign: 'center', fontSize: 14, fontFamily: typography.fontFamily.medium, color: selectedTimeframe === tf.value ? colors.text.primary : colors.text.muted }}>{tf.label}</Text>
                  </Pressable>
                ))}
              </View>
              {trends.length > 0 ? <SimpleBarChart data={trends} height={100} /> : <View style={{ height: 96, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text.disabled }}>No trend data available</Text></View>}
              {/* Legend */}
              <View style={[st.rowCenter, { justifyContent: 'center', marginTop: spacing['4'] }]}>
                <View style={[st.rowCenter, { marginRight: spacing['4'] }]}><View style={{ width: 12, height: 12, backgroundColor: '#34D399', borderRadius: 3, marginRight: 6 }} /><Text style={{ color: colors.text.muted, fontSize: 12 }}>Positive</Text></View>
                <View style={st.rowCenter}><View style={{ width: 12, height: 12, backgroundColor: '#EF4444', borderRadius: 3, marginRight: 6 }} /><Text style={{ color: colors.text.muted, fontSize: 12 }}>Negative</Text></View>
              </View>
            </View>
          </Animated.View>

          {/* Sentiment Distribution */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ paddingHorizontal: spacing['4'], marginBottom: spacing['6'] }}>
            <Text style={st.sectionLabel}>Sentiment Distribution</Text>
            <View style={st.card}>
              <SentimentDistribution stats={overallStats} />
              <View style={{ marginTop: spacing['4'] }}>
                {(['positive', 'neutral', 'negative', 'frustrated', 'urgent'] as SentimentType[]).map(type => {
                  const count = overallStats[type];
                  const percent = overallStats.total > 0 ? (count / overallStats.total) * 100 : 0;
                  const sentColors = SENTIMENT_COLORS[type];
                  return (
                    <View key={type} style={{ marginBottom: spacing['3'] }}>
                      <View style={[st.rowBetween, { marginBottom: 4 }]}>
                        <View style={st.rowCenter}><SentimentIcon type={type} size={14} /><Text style={{ fontSize: 14, marginLeft: spacing['2'], color: sentColors.icon }}>{SENTIMENT_LABELS[type]}</Text></View>
                        <Text style={{ color: colors.text.muted, fontSize: 14 }}>{count}</Text>
                      </View>
                      <View style={{ height: 8, backgroundColor: colors.border.DEFAULT, borderRadius: radius.full, overflow: 'hidden' }}>
                        <View style={{ height: '100%', borderRadius: radius.full, backgroundColor: sentColors.icon, width: `${Math.max(percent, 2)}%` }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          {/* Property Breakdown */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ paddingHorizontal: spacing['4'], marginBottom: spacing['8'] }}>
            <Text style={st.sectionLabel}>By Property</Text>
            <View style={[st.card, { overflow: 'hidden', padding: 0 }]}>
              {propertyStats.length > 0 ? propertyStats.map((propStat, index) => {
                const propPercentages = getSentimentPercentages(propStat.stats);
                const propNeg = propPercentages.negative + propPercentages.frustrated + propPercentages.urgent;
                const propPos = propPercentages.positive + propPercentages.excited;
                return (
                  <View key={propStat.propertyId} style={[{ paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] }, index < propertyStats.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT }]}>
                    <View style={[st.rowBetween, { marginBottom: spacing['2'] }]}>
                      <View style={[st.rowCenter, { flex: 1 }]}><View style={st.propIcon}><Home size={16} color="#94A3B8" /></View><Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium, flex: 1 }} numberOfLines={1}>{propStat.propertyName}</Text></View>
                      <TrendIndicator trend={propStat.trend} />
                    </View>
                    <View style={[st.rowCenter, { marginLeft: 44 }]}>
                      <View style={[st.rowCenter, { marginRight: spacing['4'] }]}><Smile size={12} color="#34D399" /><Text style={{ color: '#34D399', fontSize: 12, marginLeft: 4 }}>{propPos}%</Text></View>
                      <View style={[st.rowCenter, { marginRight: spacing['4'] }]}><Meh size={12} color="#94A3B8" /><Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 4 }}>{propPercentages.neutral}%</Text></View>
                      {propNeg > 0 && <View style={st.rowCenter}><Frown size={12} color="#F87171" /><Text style={{ color: '#F87171', fontSize: 12, marginLeft: 4 }}>{propNeg}%</Text></View>}
                      <Text style={{ color: colors.text.disabled, fontSize: 12, marginLeft: 'auto' }}>{propStat.stats.total} conversations</Text>
                    </View>
                  </View>
                );
              }) : (
                <View style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['8'], alignItems: 'center' }}>
                  <PieChart size={32} color="#64748B" /><Text style={{ color: colors.text.muted, fontSize: 14, marginTop: spacing['2'] }}>No property data available</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Info Card */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)} style={{ paddingHorizontal: spacing['4'], marginBottom: spacing['8'] }}>
            <View style={st.infoCard}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Calendar size={18} color="#64748B" />
                <View style={{ flex: 1, marginLeft: spacing['3'] }}>
                  <Text style={{ color: colors.text.secondary, fontSize: 14, fontFamily: typography.fontFamily.medium, marginBottom: 4 }}>About Sentiment Analysis</Text>
                  <Text style={{ color: colors.text.disabled, fontSize: 14, lineHeight: 20 }}>Sentiment is analyzed in real-time from guest messages. Negative or frustrated sentiment conversations are automatically prioritized in your inbox and can trigger manual review in AutoPilot mode.</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  card: { backgroundColor: colors.bg.card, borderRadius: radius['2xl'], padding: spacing['4'] },
  overviewCard: { flex: 1, borderRadius: radius['2xl'], padding: spacing['4'] },
  sectionLabel: { color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.semibold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing['2'], marginLeft: 4 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.full },
  timeTab: { flex: 1, paddingVertical: spacing['2'], borderRadius: radius.md },
  propIcon: { width: 32, height: 32, borderRadius: radius.lg, backgroundColor: colors.border.DEFAULT, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  infoCard: { backgroundColor: colors.bg.elevated, borderRadius: radius.xl, padding: spacing['4'] },
});
