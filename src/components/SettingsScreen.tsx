import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useAppStore } from '@/lib/store';
import { disconnectHostaway as disconnectLocalHostaway } from '@/lib/hostaway';
import { useNotifications } from '@/lib/NotificationProvider';
import {
  Wifi, Key, Bell, Shield, LogOut,
  Brain, BookOpen, Globe,
  BarChart3, BellOff,
  Plane, MessageSquare, Cpu, Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '@/lib/design-tokens';
import { SectionHeader, SectionFooter, Row, ToggleRow, ValueRow, LinkRow, s } from './ui/SettingsComponents';
import { getUsageStats, type UsageStats } from '@/lib/ai-usage-limiter';
import { getSelectedModel, getAvailableModels, AI_MODELS } from '@/lib/ai-keys';
import { features } from '@/lib/config';
import {
  disconnectHostaway as disconnectHostawayServer,
  getAIUsage,
  getCurrentEntitlements,
  type EntitlementsResponse,
  type UsageResponse,
} from '@/lib/api-client';

// ── Build stamp — changes with every OTA push, verifies update applied ──
const BUILD_STAMP = '2026-03-01T13:45';  // Update this each OTA push

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onNavigate?: (screen: string) => void;
}

/* ────────── Main Settings Screen ────────── */

export function SettingsScreen({ onBack, onLogout, onNavigate }: SettingsScreenProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const settings = useAppStore((s) => s.settings);
  const pushNotificationsEnabled = useAppStore((s) => s.settings.pushNotificationsEnabled);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const analytics = useAppStore((s) => s.analytics);
  const autoPilotEnabled = useAppStore((s) => s.settings.autoPilotEnabled);
  const currentTier = useAppStore((s) => s.currentTier);
  const aiLearningProgress = useAppStore((s) => s.aiLearningProgress);
  const learningEntries = useAppStore((s) => s.learningEntries);
  const draftOutcomes = useAppStore((s) => s.draftOutcomes);

  // AI Usage stats
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [activeModelName, setActiveModelName] = useState('Auto');
  const [commercialUsage, setCommercialUsage] = useState<UsageResponse | null>(null);
  const [commercialEntitlements, setCommercialEntitlements] = useState<EntitlementsResponse | null>(null);
  const [isLoadingCommercialEntitlements, setIsLoadingCommercialEntitlements] = useState(false);
  const [commercialEntitlementsError, setCommercialEntitlementsError] = useState<string | null>(null);

  const loadCommercialEntitlements = useCallback(async () => {
    if (!features.serverProxiedAI) return;
    setIsLoadingCommercialEntitlements(true);
    setCommercialEntitlementsError(null);
    try {
      const data = await getCurrentEntitlements();
      setCommercialEntitlements(data);
    } catch (error) {
      console.error('[SettingsScreen] Failed to load commercial entitlements:', error);
      setCommercialEntitlements(null);
      setCommercialEntitlementsError('Unavailable');
    } finally {
      setIsLoadingCommercialEntitlements(false);
    }
  }, []);

  const loadCommercialUsage = useCallback(async () => {
    if (!features.serverProxiedAI) return;
    try {
      const usage = await getAIUsage();
      setCommercialUsage(usage);
      setActiveModelName('Managed AI');
    } catch (error) {
      console.error('[SettingsScreen] Failed to load commercial usage:', error);
      setCommercialUsage(null);
      setActiveModelName('Managed AI');
    }
  }, []);

  useEffect(() => {
    getUsageStats().then(setUsageStats).catch(console.error);
    if (features.serverProxiedAI) {
      loadCommercialEntitlements();
      loadCommercialUsage();
      return;
    }
    // Load active model name
    (async () => {
      const selectedId = await getSelectedModel();
      if (selectedId) {
        const model = AI_MODELS.find(m => m.id === selectedId);
        if (model) { setActiveModelName(model.name); return; }
      }
      // Fall back to first available model
      const available = await getAvailableModels();
      if (available.length > 0) setActiveModelName(available[0].name);
    })();
  }, [loadCommercialEntitlements, loadCommercialUsage]);

  const { isRegistered, registerForNotifications } = useNotifications();

  const handleNavigate = (screen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigate?.(screen);
  };

  const handlePushNotificationsToggle = async (value: boolean) => {
    if (value && !isRegistered) {
      await registerForNotifications();
    }
    updateSettings({ pushNotificationsEnabled: value });
  };

  const handleLogout = () => {
    Alert.alert(
      isDemoMode ? 'Exit Demo Mode' : 'Disconnect',
      isDemoMode ? 'You\'ll need to reconnect or start a new demo.' : 'Are you sure you want to disconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isDemoMode ? 'Exit' : 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setIsDisconnecting(true);
            if (!isDemoMode) {
              if (features.serverProxiedAI) {
                await disconnectHostawayServer();
              } else {
                await disconnectLocalHostaway();
              }
            }
            onLogout();
          },
        },
      ]
    );
  };

  const commercialDraftLimit = commercialUsage?.usage.draftsLimit || 0;
  const commercialDraftsUsed = commercialUsage?.usage.draftsUsed || 0;
  const isFiniteCommercialLimit = Number.isFinite(commercialDraftLimit) && commercialDraftLimit > 0;
  const approvedLearnedCount = learningEntries.filter((e) => e.wasApproved && !e.wasEdited).length;
  const editedLearnedCount = learningEntries.filter((e) => e.wasEdited).length;
  const independentLearnedCount = draftOutcomes.filter((o) => o.outcomeType === 'independent').length;
  const effectiveMessagesTrained = (aiLearningProgress?.totalMessagesAnalyzed || 0)
    + approvedLearnedCount
    + editedLearnedCount
    + independentLearnedCount;
  const usageLabel = features.serverProxiedAI ? 'Drafts Used' : 'Drafts Today';
  const usageValue = features.serverProxiedAI
    ? (commercialUsage
      ? (isFiniteCommercialLimit
        ? `${commercialDraftsUsed} / ${commercialDraftLimit}`
        : `${commercialDraftsUsed} / Unlimited`)
      : '–')
    : (usageStats ? `${usageStats.draftsToday} / ${usageStats.dailyLimit}` : '–');
  const usagePercent = features.serverProxiedAI
    ? (isFiniteCommercialLimit ? (commercialDraftsUsed / commercialDraftLimit) * 100 : 0)
    : (usageStats?.dailyPercentage || 0);
  const shouldShowUsageBar = features.serverProxiedAI ? !!commercialUsage && isFiniteCommercialLimit : !!usageStats;
  const thisMonthValue = features.serverProxiedAI
    ? (commercialUsage ? `${commercialUsage.usage.draftsUsed} drafts` : '–')
    : (usageStats ? `${usageStats.draftsThisMonth} drafts` : '–');
  const usageFooterText = features.serverProxiedAI
    ? `${commercialUsage?.plan ? `${commercialUsage.plan.charAt(0).toUpperCase()}${commercialUsage.plan.slice(1)}` : 'Starter'} plan • Managed AI metering`
    : `${usageStats?.tierLabel || 'Starter'} plan • Resets daily at midnight`;
  const normalizedTier = currentTier === 'pro' ? 'professional' : currentTier;
  const hasPaidAutoPilot = features.serverProxiedAI
    ? commercialUsage?.limits.autopilot === true
    : normalizedTier === 'professional' || normalizedTier === 'business';
  const approvalRateValue = (() => {
    const total = analytics.aiResponsesApproved + analytics.aiResponsesEdited + analytics.aiResponsesRejected;
    if (total === 0) return '—';
    return `${Math.round((analytics.aiResponsesApproved / total) * 100)}%`;
  })();
  const openAutoPilotUpgrade = () => {
    if (features.serverProxiedAI) {
      handleNavigate('billingMemory');
      return;
    }

    Alert.alert(
      'Auto-Pilot requires a paid plan',
      'Trusted guest-reply automation is reserved for Professional and Business tiers. Upgrade controls will be surfaced with the managed commercial plan flow.'
    );
  };

  return (
    <View style={sLocal.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={sLocal.header}>
          <View style={{ width: 22 }} />
          <Text style={sLocal.headerTitle}>Settings</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={sLocal.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Connection ── */}
          <SectionHeader title="Connection" />
          <View style={s.card}>
            <Row
              icon={<Wifi size={18} color={colors.primary.DEFAULT} />}
              label="PMS Status"
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDemoMode ? '#F59E0B' : '#10B981', marginRight: 6 }} />
                  <Text style={{ color: isDemoMode ? '#F59E0B' : '#10B981', fontSize: 15, fontFamily: typography.fontFamily.medium }}>
                    {isDemoMode ? 'Demo' : 'Connected'}
                  </Text>
                </View>
              }
            />
            <LinkRow
              icon={<Key size={18} color={colors.primary.DEFAULT} />}
              label="Manage PMS Connection"
              onPress={() => handleNavigate('apiSettings')}
              isLast
            />
          </View>

          {/* ── AI Usage ── */}
          <SectionHeader title="AI Usage" />
          <View style={s.card}>
            <Row
              icon={<Zap size={18} color={colors.primary.DEFAULT} />}
              label={usageLabel}
              right={
                <Text style={s.tealValue}>
                  {usageValue}
                </Text>
              }
            />
            {shouldShowUsageBar && (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <View style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: 6,
                    borderRadius: 3,
                    width: `${Math.min(usagePercent, 100)}%`,
                    backgroundColor: usagePercent < 70 ? colors.primary.DEFAULT
                      : usagePercent < 90 ? '#F59E0B' : '#EF4444',
                  }} />
                </View>
              </View>
            )}
            {features.serverProxiedAI && (
              <ValueRow
                icon={<Cpu size={18} color={colors.primary.DEFAULT} />}
                label="AI Routing"
                value={activeModelName}
              />
            )}
            <ValueRow
              icon={<BarChart3 size={18} color={colors.primary.DEFAULT} />}
              label="This Month"
              value={thisMonthValue}
              isLast
            />
          </View>
          <SectionFooter text={usageFooterText} />

          {/* ── Commercial Memory Entitlements ── */}
          {features.serverProxiedAI && (
            <>
              <SectionHeader title="Memory Plan" />
              <View style={s.card}>
                {isLoadingCommercialEntitlements ? (
                  <Row
                    icon={<Brain size={18} color={colors.primary.DEFAULT} />}
                    label="Loading memory entitlements"
                    right={<ActivityIndicator size="small" color={colors.primary.DEFAULT} />}
                    isLast
                  />
                ) : commercialEntitlements ? (
                  <>
                    <ValueRow
                      icon={<Cpu size={18} color={colors.primary.DEFAULT} />}
                      label="Plan"
                      value={`${commercialEntitlements.plan.charAt(0).toUpperCase()}${commercialEntitlements.plan.slice(1)}`}
                    />
                    <ValueRow
                      icon={<Brain size={18} color={colors.primary.DEFAULT} />}
                      label="Memory Mode"
                      value={
                        commercialEntitlements.entitlements.supermemoryMode === 'full'
                          ? 'Full'
                          : commercialEntitlements.entitlements.supermemoryMode === 'degraded'
                            ? 'Degraded'
                            : 'Off'
                      }
                      valueColor={
                        commercialEntitlements.entitlements.supermemoryMode === 'full'
                          ? '#10B981'
                          : commercialEntitlements.entitlements.supermemoryMode === 'degraded'
                            ? '#F59E0B'
                            : '#EF4444'
                      }
                    />
                    <ValueRow
                      icon={<BarChart3 size={18} color={colors.primary.DEFAULT} />}
                      label="Reads Remaining"
                      value={
                        commercialEntitlements.entitlements.supermemoryReadLimitMonthly > 0
                          ? `${commercialEntitlements.entitlements.supermemoryReadRemaining} / ${commercialEntitlements.entitlements.supermemoryReadLimitMonthly}`
                          : 'Not included'
                      }
                    />
                    <ValueRow
                      icon={<BarChart3 size={18} color={colors.primary.DEFAULT} />}
                      label="Writes Remaining"
                      value={
                        commercialEntitlements.entitlements.supermemoryWriteLimitMonthly > 0
                          ? `${commercialEntitlements.entitlements.supermemoryWriteRemaining} / ${commercialEntitlements.entitlements.supermemoryWriteLimitMonthly}`
                          : 'Not included'
                      }
                      isLast={commercialEntitlements.entitlements.supermemoryMode === 'full'}
                    />
                    {commercialEntitlements.entitlements.supermemoryMode !== 'full' && (
                      <LinkRow
                        icon={<Zap size={18} color={colors.primary.DEFAULT} />}
                        label="Upgrade Memory Capacity"
                        onPress={() => handleNavigate(features.serverProxiedAI ? 'billingMemory' : 'upsells')}
                        isLast
                      />
                    )}
                  </>
                ) : (
                  <>
                    <ValueRow
                      icon={<Brain size={18} color={colors.primary.DEFAULT} />}
                      label="Memory Entitlements"
                      value={commercialEntitlementsError || 'Unavailable'}
                    />
                    <LinkRow
                      icon={<Zap size={18} color={colors.primary.DEFAULT} />}
                      label="Retry Entitlements Check"
                      onPress={loadCommercialEntitlements}
                      isLast
                    />
                  </>
                )}
              </View>
              <SectionFooter text="When memory is off or degraded, drafts still work but with reduced personalization." />
            </>
          )}

          {features.serverProxiedAI && (
            <>
              <SectionHeader title="Billing" />
              <View style={s.card}>
                <LinkRow
                  icon={<Shield size={18} color={colors.primary.DEFAULT} />}
                  label="Plans & Billing"
                  onPress={() => handleNavigate('billing')}
                  isLast
                />
              </View>
            </>
          )}

          {/* ── Auto-Pilot ── */}
          <SectionHeader title="Auto-Pilot" />
          <View style={s.card}>
            {hasPaidAutoPilot ? (
              <>
                <ToggleRow
                  icon={<Plane size={18} color={colors.primary.DEFAULT} />}
                  label="Auto-Pilot"
                  value={autoPilotEnabled}
                  onValueChange={(v) => {
                    if (v) {
                      Alert.alert('Enable Auto-Pilot', 'Only trusted, high-confidence guest replies are eligible for Auto-Pilot. Risky or low-confidence scenarios still require review.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Enable', onPress: () => updateSettings({ pilotMode: 'autopilot', autoPilotEnabled: true }) },
                      ]);
                    } else {
                      updateSettings({ pilotMode: 'copilot', autoPilotEnabled: false });
                    }
                  }}
                  isLast={!autoPilotEnabled}
                />
                {autoPilotEnabled && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 15, fontFamily: typography.fontFamily.regular, color: '#000000' }}>Confidence Threshold</Text>
                      <Text style={{ fontSize: 15, fontFamily: typography.fontFamily.medium, color: colors.primary.DEFAULT }}>{settings.autoPilotConfidenceThreshold}%</Text>
                    </View>
                    <Slider
                      minimumValue={50}
                      maximumValue={100}
                      step={5}
                      value={settings.autoPilotConfidenceThreshold}
                      onValueChange={(v) => updateSettings({ autoPilotConfidenceThreshold: Math.round(v) })}
                      minimumTrackTintColor={colors.primary.DEFAULT}
                      maximumTrackTintColor="#E5E7EB"
                      thumbTintColor="#FFFFFF"
                      style={{ height: 28 }}
                    />
                  </View>
                )}
              </>
            ) : (
              <LinkRow
                icon={<Plane size={18} color={colors.primary.DEFAULT} />}
                label="Unlock Auto-Pilot"
                onPress={openAutoPilotUpgrade}
                isLast
              />
            )}
          </View>
          <SectionFooter text={
            hasPaidAutoPilot
              ? (autoPilotEnabled
                ? `Only trusted replies above ${settings.autoPilotConfidenceThreshold}% confidence are eligible for Auto-Pilot. Risky or unresolved scenarios still require review.`
                : 'Trusted automation for high-confidence guest replies. Risky, low-confidence, or unresolved scenarios still require review.')
              : 'Auto-Pilot is available on paid plans for trusted high-confidence replies only.'
          } />

          {/* ── AI Learning ── */}
          <SectionHeader title="AI Learning" />
          <View style={s.card}>
            <ToggleRow
              icon={<Globe size={18} color={colors.primary.DEFAULT} />}
              label="Cultural Tone"
              value={settings.culturalToneEnabled !== false}
              onValueChange={(v) => updateSettings({ culturalToneEnabled: v })}
            />
            <ValueRow
              icon={<MessageSquare size={18} color={colors.primary.DEFAULT} />}
              label="Messages Trained"
              value={String(effectiveMessagesTrained)}
            />
            <ValueRow
              icon={<BarChart3 size={18} color={colors.primary.DEFAULT} />}
              label="Profile Strength"
              value={(() => {
                const count = effectiveMessagesTrained;
                if (count >= 500) return 'Expert';
                if (count >= 200) return 'Strong';
                if (count >= 50) return 'Learning';
                if (count > 0) return 'Building';
                return 'Not Started';
              })()}
              valueColor={colors.primary.DEFAULT}
            />
            <LinkRow
              icon={<Brain size={18} color={colors.primary.DEFAULT} />}
              label="AI Training & History"
              onPress={() => handleNavigate('aiLearning')}
            />
            <LinkRow
              icon={<BookOpen size={18} color={colors.primary.DEFAULT} />}
              label="Manage Knowledge Base"
              onPress={() => handleNavigate('propertyKnowledge')}
              isLast
            />
          </View>
          <SectionFooter text="The AI analyzes your past messages to match your tone, greetings, and sign-off style." />

          {/* ── Notifications ── */}
          <SectionHeader title="Notifications" />
          <View style={s.card}>
            <ToggleRow
              icon={<Bell size={18} color={colors.primary.DEFAULT} />}
              label="Notifications"
              value={pushNotificationsEnabled}
              onValueChange={handlePushNotificationsToggle}
            />
            <ToggleRow
              icon={<BellOff size={18} color={colors.primary.DEFAULT} />}
              label="Priority Alerts Only"
              value={settings.notificationCategories?.newMessage === false}
              onValueChange={(v) => updateSettings({ notificationCategories: { ...settings.notificationCategories, newMessage: !v } })}
              isLast
            />
          </View>

          {/* ── Performance & Insights ── */}
          <SectionHeader title="Performance & Insights" />
          <View style={s.card}>
            <Row
              icon={<BarChart3 size={18} color={colors.primary.DEFAULT} />}
              label="Approval Rate"
              right={
                <Text style={[s.tealValue, { fontSize: 17 }]}>{approvalRateValue}</Text>
              }
            />
            <ValueRow
              icon={<MessageSquare size={18} color={colors.primary.DEFAULT} />}
              label="Messages Handled"
              value={String(analytics.totalMessagesHandled)}
              isLast
            />
          </View>
          <SectionFooter text="Approval Rate reflects how often AI drafts are accepted without edits. Higher means the AI is matching your voice more closely." />

          {/* ── About ── */}
          <SectionHeader title="About" />
          <View style={s.card}>
            <ValueRow
              icon={<Shield size={18} color={colors.primary.DEFAULT} />}
              label="Version"
              value={`1.0.0 · Build ${BUILD_STAMP}`}
            />
            <LinkRow
              icon={<Shield size={18} color={colors.primary.DEFAULT} />}
              label="Privacy Policy"
              onPress={() => handleNavigate('privacySecurity')}
              isLast
            />
          </View>

          {/* ── Disconnect ── */}
          <View style={{ marginTop: 28, marginBottom: 40, paddingHorizontal: 16 }}>
            <View style={s.card}>
              <Pressable
                onPress={handleLogout}
                disabled={isDisconnecting}
                style={({ pressed }) => [s.row, { opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[s.iconBox, { backgroundColor: '#FEE2E2' }]}>
                  <LogOut size={18} color="#EF4444" />
                </View>
                <Text style={{ flex: 1, fontSize: 16, fontFamily: typography.fontFamily.regular, color: '#EF4444' }}>
                  {isDisconnecting ? 'Disconnecting...' : isDemoMode ? 'Exit Demo Mode' : 'Disconnect Hostaway'}
                </Text>
                {isDisconnecting && <ActivityIndicator size="small" color="#EF4444" />}
              </Pressable>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ────────── Styles ────────── */

const sLocal = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.semibold,
    color: '#000000',
  },
  scrollContent: {
    paddingTop: 4,
  },
  logoutBtn: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    height: 50,
  },
  logoutText: {
    color: '#EF4444',
    fontFamily: typography.fontFamily.medium,
    fontSize: 16,
    marginLeft: 8,
  },
});
