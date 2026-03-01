import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, Clock, Calendar, Gauge, AlertTriangle,
  ChevronRight, RotateCcw, History, Zap,
  Frown, Activity, Target,
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/lib/store';
import { formatScheduleDays, calculateAutoPilotAccuracy, getConfidenceMeterConfig } from '@/lib/autopilot-service';
import { colors, typography } from '@/lib/design-tokens';

interface AutoPilotSettingsScreenProps { onBack: () => void; onNavigate?: (screen: string) => void; }

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
];

/* ──────────────────────────────── Reusable Row Components ──────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={s.sectionHeader}>{title.toUpperCase()}</Text>
  );
}

function SettingRow({ icon, iconBg, label, subtitle, right, onPress, isLast = false }: {
  icon: React.ReactNode; iconBg: string; label: string; subtitle?: string;
  right?: React.ReactNode; onPress?: () => void; isLast?: boolean;
}) {
  const content = (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={[s.iconBox, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={s.rowContent}>
        <Text style={s.rowLabel}>{label}</Text>
        {subtitle && <Text style={s.rowSubtitle} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {right}
      {onPress && !right && <ChevronRight size={16} color={colors.text.disabled} />}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

function ToggleRow({ icon, iconBg, label, subtitle, value, onValueChange, trackColor, isLast = false }: {
  icon: React.ReactNode; iconBg: string; label: string; subtitle?: string;
  value: boolean; onValueChange: (v: boolean) => void; trackColor?: string; isLast?: boolean;
}) {
  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={[s.iconBox, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={s.rowContent}>
        <Text style={s.rowLabel}>{label}</Text>
        {subtitle && <Text style={s.rowSubtitle} numberOfLines={2}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onValueChange(v); }}
        trackColor={{ false: '#E2E8F0', true: trackColor || colors.accent.DEFAULT }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E2E8F0"
      />
    </View>
  );
}

function ValueRow({ icon, iconBg, label, value, isLast = false }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string; isLast?: boolean;
}) {
  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={[s.iconBox, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={s.rowContent}>
        <Text style={s.rowLabel}>{label}</Text>
      </View>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

/* ──────────────────────────────── Main Screen ──────────────────────────────── */

export function AutoPilotSettingsScreen({ onBack, onNavigate }: AutoPilotSettingsScreenProps) {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const autoPilotLogs = useAppStore(s => s.autoPilotLogs);
  const clearAutoPilotLogs = useAppStore(s => s.clearAutoPilotLogs);

  const [showScheduleDetails, setShowScheduleDetails] = useState(false);


  const accuracyStats = useMemo(() => calculateAutoPilotAccuracy(autoPilotLogs), [autoPilotLogs]);
  const thresholdConfig = getConfidenceMeterConfig(settings.autoPilotConfidenceThreshold);
  const isCoPilot = settings.pilotMode === 'copilot';
  const isAutoPilot = !isCoPilot;

  const handleModeToggle = (enableAutoPilot: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (enableAutoPilot) {
      Alert.alert(
        'Enable AutoPilot',
        `AutoPilot will automatically send AI responses when confidence is ${settings.autoPilotConfidenceThreshold}% or higher.\n\nLower confidence responses will still require your review.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => updateSettings({ pilotMode: 'autopilot', autoPilotEnabled: true }) },
        ]
      );
    } else {
      updateSettings({ pilotMode: 'copilot', autoPilotEnabled: false });
    }
  };

  const handleThresholdChange = (value: number) => {
    updateSettings({ autoPilotConfidenceThreshold: Math.round(value) });
  };

  const toggleDay = (day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentDays = [...settings.autoPilotScheduleDays];
    const index = currentDays.indexOf(day);
    if (index > -1) currentDays.splice(index, 1); else { currentDays.push(day); currentDays.sort(); }
    updateSettings({ autoPilotScheduleDays: currentDays });
  };

  const handleClearLogs = () => {
    Alert.alert('Clear Action Logs', 'This will delete all AutoPilot action history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { clearAutoPilotLogs(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Navigation Header */}
        <View style={s.header}>
          <Pressable onPress={onBack} hitSlop={12}>
            <ArrowLeft size={22} color={colors.accent.DEFAULT} />
          </Pressable>
          <Text style={s.headerTitle}>AI Automation</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ───── Automation Mode ───── */}
          <SectionHeader title="Automation Mode" />
          <View style={s.card}>
            <ToggleRow
              icon={<ShieldCheck size={18} color="#FFFFFF" />}
              iconBg={colors.accent.DEFAULT}
              label="AutoPilot"
              subtitle="Auto-send high confidence responses"
              value={isAutoPilot}
              onValueChange={(v) => handleModeToggle(v)}
            />
            <ValueRow
              icon={<ShieldAlert size={18} color="#FFFFFF" />}
              iconBg="#A855F7"
              label="Current Mode"
              value={isCoPilot ? 'CoPilot' : 'AutoPilot'}
              isLast
            />
          </View>

          {/* ───── Confidence (AutoPilot) ───── */}
          {isAutoPilot && (
            <>
              <SectionHeader title="Confidence Threshold" />
              <View style={s.card}>
                <View style={s.sliderSection}>
                  <View style={s.sliderHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[s.iconBox, { backgroundColor: thresholdConfig.color }]}>
                        <Gauge size={18} color="#FFFFFF" />
                      </View>
                      <Text style={s.rowLabel}>Auto-Send Above</Text>
                    </View>
                    <Text style={[s.thresholdValue, { color: thresholdConfig.color }]}>
                      {settings.autoPilotConfidenceThreshold}%
                    </Text>
                  </View>
                  <Slider
                    value={settings.autoPilotConfidenceThreshold}
                    onValueChange={handleThresholdChange}
                    minimumValue={70}
                    maximumValue={99}
                    step={1}
                    minimumTrackTintColor={thresholdConfig.color}
                    maximumTrackTintColor="#E2E8F0"
                    thumbTintColor={thresholdConfig.color}
                    style={{ marginVertical: 8 }}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={s.sliderLabel}>70% More auto</Text>
                    <Text style={s.sliderLabel}>99% Safer</Text>
                  </View>
                  <Text style={s.thresholdHint}>
                    {settings.autoPilotConfidenceThreshold >= 90
                      ? '✓ Very safe — only sends highly confident responses'
                      : settings.autoPilotConfidenceThreshold >= 80
                      ? '⚠ Balanced — most responses will auto-send'
                      : '⚡ Aggressive — more automation, less review'}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* ───── Schedule (AutoPilot) ───── */}
          {isAutoPilot && (
            <>
              <SectionHeader title="Schedule" />
              <View style={s.card}>
                <ToggleRow
                  icon={<Clock size={18} color="#FFFFFF" />}
                  iconBg="#6366F1"
                  label="Schedule AutoPilot"
                  subtitle={settings.autoPilotScheduleEnabled
                    ? `${formatScheduleDays(settings.autoPilotScheduleDays)}, ${settings.autoPilotScheduleStart}–${settings.autoPilotScheduleEnd}`
                    : 'Always active'}
                  value={settings.autoPilotScheduleEnabled}
                  onValueChange={(v) => updateSettings({ autoPilotScheduleEnabled: v })}
                  trackColor="#6366F1"
                  isLast={!settings.autoPilotScheduleEnabled}
                />

                {settings.autoPilotScheduleEnabled && (
                  <Pressable onPress={() => setShowScheduleDetails(!showScheduleDetails)}>
                    <View style={[s.row, { borderTopWidth: 0 }]}>
                      <View style={[s.iconBox, { backgroundColor: '#818CF8' }]}>
                        <Calendar size={18} color="#FFFFFF" />
                      </View>
                      <View style={s.rowContent}>
                        <Text style={s.rowLabel}>Configure Schedule</Text>
                      </View>
                      <ChevronRight
                        size={16}
                        color={colors.text.disabled}
                        style={{ transform: [{ rotate: showScheduleDetails ? '90deg' : '0deg' }] }}
                      />
                    </View>
                  </Pressable>
                )}

                {showScheduleDetails && settings.autoPilotScheduleEnabled && (
                  <View style={s.expandedSection}>
                    <Text style={s.expandedLabel}>Active Days</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                      {DAY_OPTIONS.map(day => {
                        const isActive = settings.autoPilotScheduleDays.includes(day.value);
                        return (
                          <Pressable
                            key={day.value}
                            onPress={() => toggleDay(day.value)}
                            style={[s.dayChip, { backgroundColor: isActive ? colors.accent.DEFAULT : '#F1F5F9' }]}
                          >
                            <Text style={{ fontFamily: typography.fontFamily.medium, fontSize: 14, color: isActive ? '#FFFFFF' : colors.text.secondary }}>
                              {day.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={s.expandedLabel}>Active Hours</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={s.timeChip}><Text style={s.timeText}>{settings.autoPilotScheduleStart}</Text></View>
                      <Text style={[s.sliderLabel, { marginHorizontal: 8 }]}>to</Text>
                      <View style={s.timeChip}><Text style={s.timeText}>{settings.autoPilotScheduleEnd}</Text></View>
                    </View>
                    <Text style={[s.thresholdHint, { marginTop: 12 }]}>
                      Outside these hours, drafts route to CoPilot for review
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ───── Escalation Rules (AutoPilot) ───── */}
          {isAutoPilot && (
            <>
              <SectionHeader title="Escalation Rules" />
              <View style={s.card}>
                <ToggleRow
                  icon={<AlertTriangle size={18} color="#FFFFFF" />}
                  iconBg="#F59E0B"
                  label="Sensitive Topics"
                  subtitle="Always require review for money, complaints"
                  value={settings.escalateSensitiveTopics}
                  onValueChange={(v) => updateSettings({ escalateSensitiveTopics: v })}
                  trackColor="#F59E0B"
                />

                {settings.escalateSensitiveTopics && (
                  <View style={s.expandedSection}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {settings.escalationTopics.map(topic => (
                        <View key={topic} style={[s.dayChip, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={{ color: '#92400E', fontSize: 13 }}>{topic}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <ToggleRow
                  icon={<Frown size={18} color="#FFFFFF" />}
                  iconBg="#EF4444"
                  label="Negative Sentiment"
                  subtitle="Route frustrated guests to manual review"
                  value={settings.escalateNegativeSentiment}
                  onValueChange={(v) => updateSettings({ escalateNegativeSentiment: v })}
                  trackColor="#EF4444"
                  isLast
                />
              </View>
            </>
          )}

          {/* ───── Performance ───── */}
          <SectionHeader title="Performance" />
          <View style={s.card}>
            <ValueRow
              icon={<Activity size={18} color="#FFFFFF" />}
              iconBg={colors.accent.DEFAULT}
              label="Total Decisions"
              value={String(accuracyStats.totalDecisions)}
            />
            <ValueRow
              icon={<Zap size={18} color="#FFFFFF" />}
              iconBg="#6366F1"
              label="Auto-Sent"
              value={String(accuracyStats.autoSentCount)}
            />
            <ValueRow
              icon={<Target size={18} color="#FFFFFF" />}
              iconBg="#10B981"
              label="Accuracy"
              value={`${accuracyStats.accuracyPercent}%`}
            />
            <SettingRow
              icon={<History size={18} color="#FFFFFF" />}
              iconBg="#8B5CF6"
              label="View Activity Log"
              subtitle={autoPilotLogs.length > 0 ? `${autoPilotLogs.length} actions recorded` : 'No actions yet'}
              onPress={() => onNavigate?.('autoPilotAuditLog')}
              isLast={autoPilotLogs.length === 0}
            />
            {autoPilotLogs.length > 0 && (
              <Pressable onPress={handleClearLogs} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <View style={[s.row, { justifyContent: 'center' }]}>
                  <RotateCcw size={14} color="#EF4444" />
                  <Text style={s.destructiveText}>Clear Logs</Text>
                </View>
              </Pressable>
            )}
          </View>

          {/* ───── About ───── */}
          <SectionHeader title="About" />
          <View style={s.card}>
            <View style={[s.aboutRow, s.rowBorder]}>
              <Text style={s.rowLabel}>Mode</Text>
              <Text style={s.rowValue}>{isCoPilot ? 'CoPilot' : 'AutoPilot'}</Text>
            </View>
            <View style={s.aboutRow}>
              <Text style={s.rowLabel}>How it works</Text>
            </View>
            <Text style={s.aboutText}>
              {isCoPilot
                ? 'All AI drafts require your approval before sending. This ensures maximum accuracy and control over guest communications.'
                : `AI responses with confidence ≥${settings.autoPilotConfidenceThreshold}% are sent automatically. Lower confidence responses are routed to CoPilot for your review.`}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ──────────────────────────────── Styles ──────────────────────────────── */

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7', // iOS system grouped background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  // Section headers
  sectionHeader: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
    letterSpacing: 0.2,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 16,
  },

  // Cards (grouped list)
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowContent: {
    flex: 1,
    marginRight: 8,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.primary,
  },
  rowSubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 16,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
  },

  // Icon box
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  // Slider section
  sliderSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  thresholdValue: {
    fontSize: 22,
    fontFamily: typography.fontFamily.bold,
  },
  sliderLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
  },
  thresholdHint: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },

  // Expanded sections
  expandedSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  expandedLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: '#6B7280',
    marginBottom: 8,
  },

  // Day chips
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },

  // Time chips
  timeChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  timeText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.primary,
    textAlign: 'center',
  },

  // About section
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Destructive
  destructiveText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
    color: '#EF4444',
    marginLeft: 6,
  },
});
