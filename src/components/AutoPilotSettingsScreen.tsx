import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, Clock, Calendar, Gauge, AlertTriangle,
  ChevronRight, RotateCcw, History, CheckCircle, XCircle, Building2, Zap,
  Info, TrendingUp, Frown,
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/lib/store';
import { ConfidenceMeter, PilotModeBadge } from './ConfidenceMeter';
import { formatScheduleDays, calculateAutoPilotAccuracy, getConfidenceMeterConfig } from '@/lib/autopilot-service';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface AutoPilotSettingsScreenProps { onBack: () => void; onNavigate?: (screen: string) => void; }

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
];

export function AutoPilotSettingsScreen({ onBack, onNavigate }: AutoPilotSettingsScreenProps) {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const autoPilotLogs = useAppStore(s => s.autoPilotLogs);
  const clearAutoPilotLogs = useAppStore(s => s.clearAutoPilotLogs);
  const properties = useAppStore(s => s.properties);

  const [showScheduleDetails, setShowScheduleDetails] = useState(false);
  const [showEscalationDetails, setShowEscalationDetails] = useState(false);
  const [showLogsPreview, setShowLogsPreview] = useState(false);

  const accuracyStats = useMemo(() => calculateAutoPilotAccuracy(autoPilotLogs), [autoPilotLogs]);

  const handleModeToggle = (mode: 'copilot' | 'autopilot') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (mode === 'autopilot') {
      Alert.alert('Enable AutoPilot Mode', `AutoPilot will automatically send AI responses when confidence is ${settings.autoPilotConfidenceThreshold}% or higher. Lower confidence responses will still require your review.\n\nYou can customize the schedule and escalation rules below.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enable', onPress: () => updateSettings({ pilotMode: 'autopilot', autoPilotEnabled: true }) },
      ]);
    } else {
      updateSettings({ pilotMode: 'copilot', autoPilotEnabled: false });
    }
  };

  const handleThresholdChange = (value: number) => { updateSettings({ autoPilotConfidenceThreshold: Math.round(value) }); };

  const toggleDay = (day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentDays = [...settings.autoPilotScheduleDays];
    const index = currentDays.indexOf(day);
    if (index > -1) currentDays.splice(index, 1); else { currentDays.push(day); currentDays.sort(); }
    updateSettings({ autoPilotScheduleDays: currentDays });
  };

  const handleClearLogs = () => {
    Alert.alert('Clear Action Logs', 'This will delete all AutoPilot action history. This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { clearAutoPilotLogs(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  const isCoPilot = settings.pilotMode === 'copilot';
  const thresholdConfig = getConfidenceMeterConfig(settings.autoPilotConfidenceThreshold);

  return (
    <View style={ap.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={ap.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [ap.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={ap.title}>AI Automation</Text>
            <Text style={ap.subtitle}>CoPilot & AutoPilot Settings</Text>
          </View>
          <PilotModeBadge mode={settings.pilotMode} />
        </Animated.View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Mode Selector */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={ap.section}>
            <Text style={ap.sectionLabel}>Automation Mode</Text>
            <View style={ap.card}>
              {/* CoPilot Option */}
              <Pressable onPress={() => handleModeToggle('copilot')} style={[ap.modeOption, { borderColor: isCoPilot ? '#A855F7' : colors.border.DEFAULT, backgroundColor: isCoPilot ? '#A855F710' : colors.bg.card, marginBottom: spacing['3'] }]}>
                <View style={ap.rowCenter}>
                  <View style={[ap.modeIcon, { backgroundColor: isCoPilot ? '#A855F720' : colors.bg.hover }]}>
                    <ShieldAlert size={24} color={isCoPilot ? '#A855F7' : colors.text.disabled} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={ap.rowCenter}>
                      <Text style={{ fontSize: 18, fontFamily: typography.fontFamily.semibold, color: isCoPilot ? colors.text.primary : colors.text.muted }}>CoPilot Mode</Text>
                      {isCoPilot && <View style={[ap.activeBadge, { backgroundColor: '#A855F7' }]}><Text style={ap.activeBadgeText}>Active</Text></View>}
                    </View>
                    <Text style={ap.modeDesc}>AI suggests, you approve every message</Text>
                  </View>
                  <View style={[ap.radio, { borderColor: isCoPilot ? '#A855F7' : colors.border.DEFAULT, backgroundColor: isCoPilot ? '#A855F7' : 'transparent' }]}>
                    {isCoPilot && <CheckCircle size={14} color="#FFFFFF" />}
                  </View>
                </View>
                <View style={ap.modeHint}><Info size={12} color={colors.text.disabled} /><Text style={ap.modeHintText}>Recommended for accuracy • Full control over responses</Text></View>
              </Pressable>

              {/* AutoPilot Option */}
              <Pressable onPress={() => handleModeToggle('autopilot')} style={[ap.modeOption, { borderColor: !isCoPilot ? colors.accent.DEFAULT : colors.border.DEFAULT, backgroundColor: !isCoPilot ? colors.accent.muted : colors.bg.card }]}>
                <View style={ap.rowCenter}>
                  <View style={[ap.modeIcon, { backgroundColor: !isCoPilot ? colors.accent.muted : colors.bg.hover }]}>
                    <ShieldCheck size={24} color={!isCoPilot ? colors.accent.DEFAULT : colors.text.disabled} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={ap.rowCenter}>
                      <Text style={{ fontSize: 18, fontFamily: typography.fontFamily.semibold, color: !isCoPilot ? colors.text.primary : colors.text.muted }}>AutoPilot Mode</Text>
                      {!isCoPilot && <View style={[ap.activeBadge, { backgroundColor: colors.accent.DEFAULT }]}><Text style={ap.activeBadgeText}>Active</Text></View>}
                    </View>
                    <Text style={ap.modeDesc}>Auto-send high confidence responses</Text>
                  </View>
                  <View style={[ap.radio, { borderColor: !isCoPilot ? colors.accent.DEFAULT : colors.border.DEFAULT, backgroundColor: !isCoPilot ? colors.accent.DEFAULT : 'transparent' }]}>
                    {!isCoPilot && <CheckCircle size={14} color="#FFFFFF" />}
                  </View>
                </View>
                <View style={ap.modeHint}><Zap size={12} color={colors.text.disabled} /><Text style={ap.modeHintText}>Faster responses • Schedule & escalation controls</Text></View>
              </Pressable>
            </View>
          </Animated.View>

          {/* Confidence Threshold (AutoPilot only) */}
          {!isCoPilot && (
            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={ap.section}>
              <Text style={ap.sectionLabel}>Confidence Threshold</Text>
              <View style={ap.card}>
                <View style={[ap.rowBetween, { marginBottom: spacing['3'] }]}>
                  <View style={ap.rowCenter}><Gauge size={20} color={thresholdConfig.color} /><Text style={[ap.white, { marginLeft: spacing['2'] }]}>Auto-Send Above</Text></View>
                  <View style={[ap.thresholdBadge, { backgroundColor: `${thresholdConfig.color}20` }]}>
                    <Text style={{ color: thresholdConfig.color, fontFamily: typography.fontFamily.bold, fontSize: 18 }}>{settings.autoPilotConfidenceThreshold}%</Text>
                  </View>
                </View>
                <Slider value={settings.autoPilotConfidenceThreshold} onValueChange={handleThresholdChange} minimumValue={70} maximumValue={99} step={1} minimumTrackTintColor={thresholdConfig.color} maximumTrackTintColor="#334155" thumbTintColor={thresholdConfig.color} />
                <View style={[ap.rowBetween, { marginTop: spacing['2'] }]}>
                  <Text style={ap.hint}>70% (More auto)</Text><Text style={ap.hint}>99% (Safer)</Text>
                </View>
                <View style={ap.infobox}>
                  <Text style={{ color: colors.text.secondary, fontSize: 14 }}>
                    {settings.autoPilotConfidenceThreshold >= 90 ? '✓ Very safe - Only sends highly confident responses'
                      : settings.autoPilotConfidenceThreshold >= 80 ? '⚠ Balanced - Most responses will auto-send'
                      : '⚡ Aggressive - More automation, less review'}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Schedule Settings (AutoPilot only) */}
          {!isCoPilot && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)} style={ap.section}>
              <Text style={ap.sectionLabel}>Schedule</Text>
              <View style={ap.listCard}>
                <View style={[ap.settingRow, ap.borderBottom]}>
                  <View style={[ap.iconBoxSmall, { backgroundColor: colors.bg.hover }]}><Clock size={20} color={colors.text.disabled} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={ap.white}>Schedule AutoPilot</Text>
                    <Text style={ap.hint}>{settings.autoPilotScheduleEnabled ? `${formatScheduleDays(settings.autoPilotScheduleDays)}, ${settings.autoPilotScheduleStart}-${settings.autoPilotScheduleEnd}` : 'Always active'}</Text>
                  </View>
                  <Switch value={settings.autoPilotScheduleEnabled} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateSettings({ autoPilotScheduleEnabled: v }); }} trackColor={{ false: '#334155', true: colors.accent.DEFAULT }} thumbColor="#FFFFFF" />
                </View>

                {settings.autoPilotScheduleEnabled && (
                  <Pressable onPress={() => setShowScheduleDetails(!showScheduleDetails)} style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] }}>
                    <View style={ap.rowBetween}>
                      <View style={ap.rowCenter}><Calendar size={16} color={colors.text.disabled} /><Text style={[ap.muted, { marginLeft: spacing['2'] }]}>Configure Schedule</Text></View>
                      <ChevronRight size={18} color={colors.text.disabled} />
                    </View>
                    {showScheduleDetails && (
                      <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing['4'] }}>
                        <Text style={[ap.hint, { marginBottom: spacing['2'] }]}>Active Days</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing['4'] }}>
                          {DAY_OPTIONS.map(day => {
                            const isActive = settings.autoPilotScheduleDays.includes(day.value);
                            return (
                              <Pressable key={day.value} onPress={() => toggleDay(day.value)} style={[ap.dayBtn, { backgroundColor: isActive ? colors.accent.DEFAULT : colors.bg.hover, marginRight: spacing['2'], marginBottom: spacing['2'] }]}>
                                <Text style={{ fontFamily: typography.fontFamily.medium, color: isActive ? '#FFF' : colors.text.muted }}>{day.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Text style={[ap.hint, { marginBottom: spacing['2'] }]}>Active Hours</Text>
                        <View style={ap.rowCenter}>
                          <View style={ap.timeBox}><Text style={ap.timeText}>{settings.autoPilotScheduleStart}</Text></View>
                          <Text style={ap.hint}>to</Text>
                          <View style={[ap.timeBox, { marginLeft: spacing['2'] }]}><Text style={ap.timeText}>{settings.autoPilotScheduleEnd}</Text></View>
                        </View>
                        <Text style={[ap.hint, { marginTop: spacing['2'] }]}>Outside these hours, drafts route to CoPilot for review</Text>
                      </Animated.View>
                    )}
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Escalation Settings (AutoPilot only) */}
          {!isCoPilot && (
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={ap.section}>
              <Text style={ap.sectionLabel}>Escalation Rules</Text>
              <View style={ap.listCard}>
                <View style={[ap.settingRow, ap.borderBottom]}>
                  <View style={[ap.iconBoxSmall, { backgroundColor: '#F59E0B20' }]}><AlertTriangle size={20} color="#F59E0B" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={ap.white}>Escalate Sensitive Topics</Text>
                    <Text style={ap.hint}>Always require review for money, complaints</Text>
                  </View>
                  <Switch value={settings.escalateSensitiveTopics} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateSettings({ escalateSensitiveTopics: v }); }} trackColor={{ false: '#334155', true: '#F59E0B' }} thumbColor="#FFFFFF" />
                </View>

                {settings.escalateSensitiveTopics && (
                  <Pressable onPress={() => setShowEscalationDetails(!showEscalationDetails)} style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] }}>
                    <View style={ap.rowBetween}>
                      <Text style={ap.muted}>{settings.escalationTopics.length} topics configured</Text>
                      <ChevronRight size={18} color={colors.text.disabled} />
                    </View>
                    {showEscalationDetails && (
                      <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing['3'] }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          {settings.escalationTopics.map(topic => (
                            <View key={topic} style={ap.topicTag}><Text style={{ color: '#FBBF24', fontSize: 14 }}>{topic}</Text></View>
                          ))}
                        </View>
                        <Text style={[ap.hint, { marginTop: spacing['2'] }]}>Messages containing these topics will always require manual review</Text>
                      </Animated.View>
                    )}
                  </Pressable>
                )}

                {/* Negative Sentiment Escalation */}
                <View style={[ap.settingRow, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}>
                  <View style={[ap.iconBoxSmall, { backgroundColor: '#F8717120' }]}><Frown size={20} color="#F87171" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={ap.white}>Escalate Negative Sentiment</Text>
                    <Text style={ap.hint}>Route frustrated/angry guests to manual review</Text>
                  </View>
                  <Switch value={settings.escalateNegativeSentiment} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateSettings({ escalateNegativeSentiment: v }); }} trackColor={{ false: '#334155', true: '#F87171' }} thumbColor="#FFFFFF" />
                </View>

                {settings.escalateNegativeSentiment && (
                  <View style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['4'] }}>
                    <View style={{ backgroundColor: '#F8717110', borderRadius: radius.sm, padding: spacing['3'] }}>
                      <Text style={{ color: '#FCA5A5', fontSize: 14 }}>When enabled, messages from guests with negative, frustrated, or urgent sentiment will always require your manual review, regardless of AI confidence.</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing['2'] }}>
                        {['Negative', 'Frustrated', 'Urgent', 'Angry', 'Anxious'].map(emotion => (
                          <View key={emotion} style={{ backgroundColor: '#F8717120', paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.xs, marginRight: spacing['2'], marginBottom: 4 }}>
                            <Text style={{ color: '#F87171', fontSize: 12 }}>{emotion}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* Action Logs & Stats */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)} style={ap.section}>
            <Text style={ap.sectionLabel}>Performance & Logs</Text>
            <View style={ap.card}>
              {/* Stats Row */}
              <View style={[ap.rowCenter, { marginBottom: spacing['4'] }]}>
                <View style={ap.statBox}>
                  <Text style={ap.statNum}>{accuracyStats.totalDecisions}</Text>
                  <Text style={ap.hint}>Total Decisions</Text>
                </View>
                <View style={[ap.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border.DEFAULT }]}>
                  <Text style={[ap.statNum, { color: colors.accent.DEFAULT }]}>{accuracyStats.autoSentCount}</Text>
                  <Text style={ap.hint}>Auto-Sent</Text>
                </View>
                <View style={ap.statBox}>
                  <Text style={[ap.statNum, { color: colors.success.DEFAULT }]}>{accuracyStats.accuracyPercent}%</Text>
                  <Text style={ap.hint}>Accuracy</Text>
                </View>
              </View>

              {/* Recent Logs Preview */}
              <Pressable onPress={() => setShowLogsPreview(!showLogsPreview)} style={ap.logsWrap}>
                <View style={ap.rowBetween}>
                  <View style={ap.rowCenter}><History size={16} color={colors.text.disabled} /><Text style={[ap.secondary, { marginLeft: spacing['2'] }]}>Recent Activity</Text></View>
                  <ChevronRight size={18} color={colors.text.disabled} style={{ transform: [{ rotate: showLogsPreview ? '90deg' : '0deg' }] }} />
                </View>
                {showLogsPreview && autoPilotLogs.length > 0 && (
                  <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing['3'] }}>
                    {autoPilotLogs.slice(0, 3).map((log, idx) => (
                      <View key={log.id} style={[{ paddingVertical: spacing['2'] }, idx < 2 && ap.borderBottom]}>
                        <View style={ap.rowBetween}>
                          <View style={[ap.rowCenter, { flex: 1 }]}>
                            {log.action === 'auto_sent' ? <CheckCircle size={14} color={colors.success.DEFAULT} /> : log.action === 'escalated' ? <AlertTriangle size={14} color="#F59E0B" /> : <XCircle size={14} color={colors.text.disabled} />}
                            <Text style={[ap.secondary, { marginLeft: spacing['2'] }]} numberOfLines={1}>{log.guestName}</Text>
                          </View>
                          <Text style={ap.hint}>{log.confidence}%</Text>
                        </View>
                        <Text style={[ap.hint, { marginTop: 4 }]} numberOfLines={1}>{log.reason}</Text>
                      </View>
                    ))}
                    {autoPilotLogs.length > 3 && (
                      <Pressable onPress={() => onNavigate?.('autoPilotAuditLog')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginTop: spacing['2'] })}>
                        <Text style={{ color: colors.accent.DEFAULT, fontSize: 14, textAlign: 'center', fontFamily: typography.fontFamily.medium }}>View All {autoPilotLogs.length} Logs →</Text>
                      </Pressable>
                    )}
                  </Animated.View>
                )}
                {showLogsPreview && autoPilotLogs.length === 0 && <Text style={[ap.hint, { textAlign: 'center', marginTop: spacing['3'] }]}>No action logs yet</Text>}
              </Pressable>

              {/* Clear Logs Button */}
              {autoPilotLogs.length > 0 && (
                <Pressable onPress={handleClearLogs} style={({ pressed }) => [ap.clearBtn, { opacity: pressed ? 0.7 : 1 }]}>
                  <RotateCcw size={14} color={colors.text.disabled} /><Text style={[ap.hint, { marginLeft: 6 }]}>Clear Logs</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>

          {/* Info Card */}
          <Animated.View entering={FadeInDown.delay(600).duration(400)} style={[ap.section, { marginBottom: spacing['8'] }]}>
            <View style={[ap.card, { backgroundColor: colors.bg.elevated + '4D' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Info size={18} color={colors.text.disabled} />
                <View style={{ flex: 1, marginLeft: spacing['3'] }}>
                  <Text style={[ap.secondary, { fontFamily: typography.fontFamily.medium, marginBottom: 4 }]}>{isCoPilot ? 'CoPilot Mode' : 'AutoPilot Mode'}</Text>
                  <Text style={{ color: colors.text.disabled, fontSize: 14, lineHeight: 20 }}>
                    {isCoPilot ? 'All AI drafts require your approval before sending. This ensures maximum accuracy and control over guest communications.'
                      : `AI responses with confidence ≥${settings.autoPilotConfidenceThreshold}% are sent automatically. Lower confidence responses are routed to CoPilot for your review.`}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ap = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  subtitle: { color: colors.text.muted, fontSize: 14 },
  section: { paddingHorizontal: spacing['4'], marginBottom: spacing['6'] },
  sectionLabel: { color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing['2'], marginLeft: 4 },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'] },
  listCard: { backgroundColor: colors.bg.card, borderRadius: radius.xl, overflow: 'hidden' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  white: { color: colors.text.primary, fontFamily: typography.fontFamily.medium },
  secondary: { color: colors.text.secondary, fontFamily: typography.fontFamily.medium, fontSize: 14 },
  muted: { color: colors.text.muted, fontSize: 14 },
  hint: { color: colors.text.disabled, fontSize: 12 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  modeOption: { borderRadius: radius.md, padding: spacing['4'], borderWidth: 2 },
  modeIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  modeDesc: { color: colors.text.muted, fontSize: 14, marginTop: 2 },
  modeHint: { flexDirection: 'row', alignItems: 'center', marginTop: spacing['3'] },
  modeHintText: { color: colors.text.disabled, fontSize: 12, marginLeft: 6 },
  activeBadge: { marginLeft: spacing['2'], paddingHorizontal: spacing['2'], paddingVertical: 2, borderRadius: radius.full },
  activeBadgeText: { color: '#FFF', fontSize: 12, fontFamily: typography.fontFamily.medium },
  radio: { width: 24, height: 24, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  thresholdBadge: { paddingHorizontal: spacing['3'], paddingVertical: 4, borderRadius: radius.full },
  infobox: { marginTop: spacing['4'], backgroundColor: colors.bg.hover, borderRadius: radius.sm, padding: spacing['3'] },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] },
  iconBoxSmall: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  dayBtn: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  timeBox: { flex: 1, backgroundColor: colors.bg.hover, borderRadius: radius.sm, paddingHorizontal: spacing['3'], paddingVertical: spacing['2'], marginRight: spacing['2'] },
  timeText: { color: colors.text.primary, textAlign: 'center' },
  topicTag: { backgroundColor: '#F59E0B20', paddingHorizontal: spacing['3'], paddingVertical: 6, borderRadius: radius.full, marginRight: spacing['2'], marginBottom: spacing['2'] },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  logsWrap: { backgroundColor: colors.bg.hover, borderRadius: radius.sm, padding: spacing['3'] },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing['3'], paddingVertical: spacing['2'] },
});
