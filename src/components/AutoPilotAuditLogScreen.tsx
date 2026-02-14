import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, CheckCircle, AlertTriangle, XCircle, Clock,
  History, Filter, MessageSquare, Building2, Gauge,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppStore, type AutoPilotActionLog } from '@/lib/store';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface AutoPilotAuditLogScreenProps { onBack: () => void; }

type ActionFilter = 'all' | 'auto_sent' | 'routed_to_copilot' | 'escalated' | 'blocked_schedule';

const FILTER_OPTIONS: { value: ActionFilter; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: colors.text.primary },
  { value: 'auto_sent', label: 'Sent', color: '#22C55E' },
  { value: 'escalated', label: 'Escalated', color: '#F59E0B' },
  { value: 'routed_to_copilot', label: 'Routed', color: '#A855F7' },
  { value: 'blocked_schedule', label: 'Blocked', color: '#64748B' },
];

function getActionConfig(action: AutoPilotActionLog['action']) {
  switch (action) {
    case 'auto_sent': return { icon: CheckCircle, color: '#22C55E', label: 'Auto-Sent', bg: '#22C55E15' };
    case 'escalated': return { icon: AlertTriangle, color: '#F59E0B', label: 'Escalated', bg: '#F59E0B15' };
    case 'routed_to_copilot': return { icon: Clock, color: '#A855F7', label: 'Routed to CoPilot', bg: '#A855F715' };
    case 'blocked_schedule': return { icon: XCircle, color: '#64748B', label: 'Blocked (Schedule)', bg: '#64748B15' };
  }
}

function formatTimestamp(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AutoPilotAuditLogScreen({ onBack }: AutoPilotAuditLogScreenProps) {
  const autoPilotLogs = useAppStore(s => s.autoPilotLogs);
  const [activeFilter, setActiveFilter] = useState<ActionFilter>('all');

  const handleFilter = useCallback((filter: ActionFilter) => {
    Haptics.selectionAsync();
    setActiveFilter(filter);
  }, []);

  const filteredLogs = useMemo(() => {
    const sorted = [...autoPilotLogs].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    if (activeFilter === 'all') return sorted;
    return sorted.filter(log => log.action === activeFilter);
  }, [autoPilotLogs, activeFilter]);

  const stats = useMemo(() => {
    const total = autoPilotLogs.length;
    const autoSent = autoPilotLogs.filter(l => l.action === 'auto_sent').length;
    const escalated = autoPilotLogs.filter(l => l.action === 'escalated').length;
    const routed = autoPilotLogs.filter(l => l.action === 'routed_to_copilot').length;
    const blocked = autoPilotLogs.filter(l => l.action === 'blocked_schedule').length;
    const avgConfidence = total > 0
      ? Math.round(autoPilotLogs.reduce((sum, l) => sum + l.confidence, 0) / total)
      : 0;
    return { total, autoSent, escalated, routed, blocked, avgConfidence };
  }, [autoPilotLogs]);

  const renderLogItem = (log: AutoPilotActionLog, index: number) => {
    const config = getActionConfig(log.action);
    const Icon = config.icon;

    return (
      <Animated.View
        key={log.id}
        entering={FadeInDown.delay(Math.min(index * 40, 400)).duration(300)}
        style={s.logCard}
      >
        <View style={s.logHeader}>
          <View style={[s.actionBadge, { backgroundColor: config.bg }]}>
            <Icon size={14} color={config.color} />
            <Text style={[s.actionLabel, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={s.timestamp}>{formatTimestamp(log.timestamp)}</Text>
        </View>

        <View style={s.logBody}>
          <View style={s.logMeta}>
            <View style={s.metaItem}>
              <MessageSquare size={12} color={colors.text.disabled} />
              <Text style={s.metaText} numberOfLines={1}>{log.guestName}</Text>
            </View>
            <View style={s.metaItem}>
              <Building2 size={12} color={colors.text.disabled} />
              <Text style={s.metaText} numberOfLines={1}>{log.propertyName}</Text>
            </View>
            <View style={s.metaItem}>
              <Gauge size={12} color={config.color} />
              <Text style={[s.metaText, { color: config.color }]}>{log.confidence}%</Text>
            </View>
          </View>

          {log.messagePreview ? (
            <View style={s.previewBox}>
              <Text style={s.previewText} numberOfLines={2}>"{log.messagePreview}"</Text>
            </View>
          ) : null}

          {log.reason ? (
            <Text style={s.reasonText}>{log.reason}</Text>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={[colors.bg.elevated, colors.bg.subtle]} style={s.gradient} />
      <SafeAreaView style={s.flex} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={s.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <View style={s.flex}>
            <Text style={s.title}>Audit Log</Text>
            <Text style={s.subtitle}>AutoPilot action history</Text>
          </View>
          <View style={s.totalBadge}>
            <History size={14} color={colors.text.muted} />
            <Text style={s.totalText}>{stats.total}</Text>
          </View>
        </Animated.View>

        <ScrollView style={s.flex} showsVerticalScrollIndicator={false}>
          {/* Stats Summary */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.statsRow}>
            <View style={[s.statCard, { borderBottomColor: '#22C55E' }]}>
              <Text style={[s.statNum, { color: '#22C55E' }]}>{stats.autoSent}</Text>
              <Text style={s.statLabel}>Sent</Text>
            </View>
            <View style={[s.statCard, { borderBottomColor: '#F59E0B' }]}>
              <Text style={[s.statNum, { color: '#F59E0B' }]}>{stats.escalated}</Text>
              <Text style={s.statLabel}>Escalated</Text>
            </View>
            <View style={[s.statCard, { borderBottomColor: '#A855F7' }]}>
              <Text style={[s.statNum, { color: '#A855F7' }]}>{stats.routed}</Text>
              <Text style={s.statLabel}>Routed</Text>
            </View>
            <View style={[s.statCard, { borderBottomColor: colors.text.disabled }]}>
              <Text style={[s.statNum, { color: colors.text.disabled }]}>{stats.avgConfidence}%</Text>
              <Text style={s.statLabel}>Avg Conf</Text>
            </View>
          </Animated.View>

          {/* Filter Pills */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.filterRow}>
            <Filter size={14} color={colors.text.disabled} />
            {FILTER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => handleFilter(opt.value)}
                style={[
                  s.filterPill,
                  activeFilter === opt.value && { backgroundColor: `${opt.color}15`, borderColor: `${opt.color}40`, borderWidth: 1 },
                ]}
              >
                <Text style={[
                  s.filterText,
                  activeFilter === opt.value && { color: opt.color, fontFamily: typography.fontFamily.semibold },
                ]}>{opt.label}</Text>
              </Pressable>
            ))}
          </Animated.View>

          {/* Log Items */}
          <View style={s.logsContainer}>
            {filteredLogs.length === 0 ? (
              <Animated.View entering={FadeIn.duration(300)} style={s.emptyState}>
                <History size={32} color={colors.text.disabled} />
                <Text style={s.emptyTitle}>
                  {activeFilter === 'all' ? 'No actions yet' : `No ${FILTER_OPTIONS.find(f => f.value === activeFilter)?.label.toLowerCase()} actions`}
                </Text>
                <Text style={s.emptyDesc}>
                  AutoPilot decisions will appear here as they happen.
                </Text>
              </Animated.View>
            ) : (
              filteredLogs.map((log, index) => renderLogItem(log, index))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  flex: { flex: 1 },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, height: 200 },
  header: {
    paddingHorizontal: spacing['4'], paddingVertical: spacing['3'],
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: `${colors.bg.elevated}E6`,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  subtitle: { color: colors.text.muted, fontSize: 13, marginTop: 1 },
  totalBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: `${colors.bg.elevated}CC`,
    paddingHorizontal: spacing['3'], paddingVertical: spacing['1.5'],
    borderRadius: radius.full, gap: spacing['1.5'],
  },
  totalText: { color: colors.text.muted, fontFamily: typography.fontFamily.semibold, fontSize: 14 },
  // Stats
  statsRow: {
    flexDirection: 'row', paddingHorizontal: spacing['4'],
    paddingTop: spacing['2'], paddingBottom: spacing['2'],
    gap: spacing['2'],
  },
  statCard: {
    flex: 1, backgroundColor: `${colors.bg.elevated}E6`,
    borderRadius: radius.lg, padding: spacing['3'],
    alignItems: 'center', borderBottomWidth: 2,
  },
  statNum: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  statLabel: { color: colors.text.disabled, fontSize: 11, fontFamily: typography.fontFamily.medium, marginTop: 2 },
  // Filters
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing['4'], paddingVertical: spacing['3'],
    gap: spacing['2'],
  },
  filterPill: {
    paddingHorizontal: spacing['3'], paddingVertical: spacing['1.5'],
    borderRadius: radius.full,
    backgroundColor: `${colors.bg.elevated}80`,
  },
  filterText: { color: colors.text.muted, fontSize: 12, fontFamily: typography.fontFamily.medium },
  // Log items
  logsContainer: { paddingHorizontal: spacing['4'], paddingBottom: spacing['8'] },
  logCard: {
    backgroundColor: `${colors.bg.elevated}E6`,
    borderRadius: radius['2xl'], padding: spacing['4'],
    marginBottom: spacing['3'],
  },
  logHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing['3'],
  },
  actionBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing['2.5'], paddingVertical: 4,
    borderRadius: radius.full, gap: spacing['1.5'],
  },
  actionLabel: { fontSize: 12, fontFamily: typography.fontFamily.semibold },
  timestamp: { color: colors.text.disabled, fontSize: 12 },
  logBody: {},
  logMeta: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap', gap: spacing['3'],
    marginBottom: spacing['2'],
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.text.muted, fontSize: 13 },
  previewBox: {
    backgroundColor: `${colors.bg.elevated}80`,
    borderRadius: radius.md, padding: spacing['3'],
    marginTop: spacing['2'], borderLeftWidth: 2,
    borderLeftColor: `${colors.border.DEFAULT}80`,
  },
  previewText: { color: colors.text.secondary, fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  reasonText: { color: colors.text.disabled, fontSize: 12, marginTop: spacing['2'] },
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: spacing['10'] },
  emptyTitle: {
    color: colors.text.primary, fontFamily: typography.fontFamily.semibold,
    fontSize: 16, marginTop: spacing['3'],
  },
  emptyDesc: { color: colors.text.muted, fontSize: 14, marginTop: spacing['1'], textAlign: 'center' },
});
