import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useAppStore } from '@/lib/store';
import { disconnectHostaway as disconnectLocalHostaway } from '@/lib/hostaway';
import { useNotifications } from '@/lib/NotificationProvider';
import {
  Wifi, Key, Bell, Shield, LogOut,
  Brain, BookOpen, Globe, Mic,
  BarChart3, BellOff,
  Plane, MessageSquare, Cpu, Zap,
  User, Trash2, HelpCircle, RefreshCw,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/lib/design-tokens';
import { useThemeColors, useIsDark } from '@/lib/useThemeColors';
import { SectionHeader, SectionFooter, Row, ToggleRow, ValueRow, LinkRow, useThemedCardStyle, s } from './ui/SettingsComponents';
import { SettingsBottomSheet } from './ui/SettingsBottomSheet';
import { getUsageStats, type UsageStats } from '@/lib/ai-usage-limiter';
import { getSelectedModel, getAvailableModels, AI_MODELS } from '@/lib/ai-keys';
import { features, isPersonal } from '@/lib/config';
import {
  disconnectHostaway as disconnectHostawayServer,
  getAIUsage,
  getCurrentEntitlements,
  type EntitlementsResponse,
  type UsageResponse,
} from '@/lib/api-client';
import { syncLearningToCloud, canSync } from '@/lib/learning-sync';
import { loadFounderSession, clearFounderSession } from '@/lib/secure-storage';
import { API_BASE_URL } from '@/lib/config';
import { DemoModeBanner } from './DemoModeBanner';

// Lazy-load bottom sheet content components
import { default as ConfidenceDetail } from '@/components/ConfidenceDetail';
import { TestVoiceScreen } from '@/components/TestVoiceScreen';
import { AIProviderSettingsScreen } from '@/components/AIProviderSettingsScreen';
import { AutomationsScreen } from '@/components/AutomationsScreen';
import { SyncDataScreen } from '@/components/SyncDataScreen';
import { HelpCenterScreen } from '@/components/HelpCenterScreen';
import { ApiSettingsScreen } from '@/components/ApiSettingsScreen';

// iOS system icon colors per section
const ic = {
  green:  { bg: '#34C75920', fg: '#34C759' },
  blue:   { bg: '#007AFF20', fg: '#007AFF' },
  purple: { bg: '#AF52DE20', fg: '#AF52DE' },
  orange: { bg: '#FF950020', fg: '#FF9500' },
  teal:   { bg: '#14B8A620', fg: '#14B8A6' },
  red:    { bg: '#FF3B3020', fg: '#FF3B30' },
  indigo: { bg: '#5856D620', fg: '#5856D6' },
  gray:   { bg: '#8E8E9320', fg: '#8E8E93' },
};

// ── Build stamp — changes with every OTA push, verifies update applied ──
const BUILD_STAMP = '2026-03-01T13:45';  // Update this each OTA push

type SheetId = 'voiceConfidence' | 'testVoice' | 'aiProviders' | 'automations' | 'syncData' | 'helpCenter' | 'apiSettings' | null;

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onNavigate?: (screen: string) => void;
}

/* ────────── Main Settings Screen ────────── */

export function SettingsScreen({ onBack, onLogout, onNavigate }: SettingsScreenProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeSheet, setActiveSheet] = useState<SheetId>(null);
  const resetStore = useAppStore((s) => s.resetStore);
  const t = useThemeColors();
  const isDark = useIsDark();
  const cardStyle = useThemedCardStyle();

  const settings = useAppStore((s) => s.settings);
  const pushNotificationsEnabled = useAppStore((s) => s.settings.pushNotificationsEnabled);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const exitDemoMode = useAppStore((s) => s.exitDemoMode);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const analytics = useAppStore((s) => s.analytics);
  const autoPilotEnabled = useAppStore((s) => s.settings.autoPilotEnabled);
  const currentTier = useAppStore((s) => s.currentTier);
  const aiLearningProgress = useAppStore((s) => s.aiLearningProgress);
  const founderSession = useAppStore((s) => s.founderSession);
  const learningEntries = useAppStore((s) => s.learningEntries);
  const draftOutcomes = useAppStore((s) => s.draftOutcomes);

  // AI Usage stats
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [activeModelName, setActiveModelName] = useState('Auto');
  const [commercialUsage, setCommercialUsage] = useState<UsageResponse | null>(null);

  const loadCommercialUsage = useCallback(async () => {
    if (!features.serverProxiedAI || isDemoMode) return;
    try {
      const usage = await getAIUsage();
      setCommercialUsage(usage);
      setActiveModelName('Managed AI');
    } catch (error) {
      console.error('[SettingsScreen] Failed to load commercial usage:', error);
      setCommercialUsage(null);
      setActiveModelName('Managed AI');
    }
  }, [isDemoMode]);

  useEffect(() => {
    if (!isDemoMode) getUsageStats().then(setUsageStats).catch(console.error);
    if (features.serverProxiedAI) {
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
  }, [loadCommercialUsage]);

  const { isRegistered, registerForNotifications } = useNotifications();

  const handleNavigate = (screen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigate?.(screen);
  };

  const openSheet = (sheet: SheetId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveSheet(sheet);
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

            // Sync learning data to cloud before disconnecting
            if (!isDemoMode) {
              const session = await canSync();
              if (session) {
                try {
                  const syncPromise = syncLearningToCloud();
                  const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Sync timeout')), 10000)
                  );
                  await Promise.race([syncPromise, timeoutPromise]);
                  console.log('[Settings] Learning synced before disconnect');
                } catch (err) {
                  const proceed = await new Promise<boolean>((resolve) => {
                    Alert.alert(
                      'Learning data may not be saved',
                      'Could not sync your voice profile to the cloud. Disconnect anyway?',
                      [
                        { text: 'Cancel', onPress: () => resolve(false) },
                        { text: 'Disconnect', style: 'destructive', onPress: () => resolve(true) },
                      ]
                    );
                  });
                  if (!proceed) {
                    setIsDisconnecting(false);
                    return;
                  }
                }
              }
            }

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

  const handleDeleteMyData = () => {
    Alert.alert(
      'Delete All Data',
      'This permanently deletes your voice profile, learned patterns, and all training data from our servers. Your Hostaway connection is not affected. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const session = await loadFounderSession();
              if (!session) {
                // No cloud account — just reset local state
                resetStore();
                setIsDeleting(false);
                return;
              }

              const res = await fetch(`${API_BASE_URL}/api/auth/account-data`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.accessToken}`,
                },
              });

              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                Alert.alert('Deletion Failed', body.message || 'Could not delete your data. Please try again.');
                setIsDeleting(false);
                return;
              }

              await clearFounderSession();
              resetStore();
              console.log('[Settings] All user data deleted');
            } catch (err) {
              console.error('[Settings] Delete my data error:', err);
              Alert.alert('Deletion Failed', 'A network error occurred. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // ── Computed values ──
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
  const isFounderPersonal = isPersonal && !!founderSession;
  const normalizedTier = currentTier === 'pro' ? 'professional' : currentTier;
  const hasPaidAutoPilot = features.serverProxiedAI
    ? commercialUsage?.limits.autopilot === true
    : isFounderPersonal || normalizedTier === 'professional' || normalizedTier === 'business';

  // Profile info
  const profileEmail = founderSession?.email || (settings.accountId ? `Account ${settings.accountId}` : 'Not connected');
  const planLabel = features.serverProxiedAI
    ? (commercialUsage?.plan ? `${commercialUsage.plan.charAt(0).toUpperCase()}${commercialUsage.plan.slice(1)}` : 'Starter')
    : isFounderPersonal ? 'Founder' : (currentTier === 'free' ? 'Free' : normalizedTier.charAt(0).toUpperCase() + normalizedTier.slice(1));

  const openAutoPilotUpgrade = () => {
    Alert.alert(
      'Auto-Pilot requires a paid plan',
      'Trusted guest-reply automation is reserved for Professional and Business tiers. Upgrade controls will be surfaced with the managed commercial plan flow.'
    );
  };

  return (
    <View style={[sLocal.root, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Demo Mode Banner */}
        {isDemoMode && (
          <DemoModeBanner
            onExitDemo={() => {
              exitDemoMode();
              import('expo-router').then(({ router }) => router.replace('/onboarding'));
            }}
          />
        )}

        {/* Large title header — iOS style */}
        <View style={sLocal.header}>
          <Text style={[sLocal.headerTitle, { color: t.text.primary }]}>Settings</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={sLocal.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Profile Header ── */}
          <View style={[sLocal.profileCard, { backgroundColor: t.bg.card }]}>
            <View style={sLocal.profileAvatar}>
              <User size={24} color="#FFFFFF" />
            </View>
            <View style={sLocal.profileInfo}>
              <Text style={[sLocal.profileEmail, { color: t.text.primary }]} numberOfLines={1}>{profileEmail}</Text>
              <View style={sLocal.planBadge}>
                <Text style={sLocal.planBadgeText}>{planLabel}</Text>
              </View>
            </View>
            <ChevronRight size={14} color={t.text.disabled} />
          </View>

          {/* ── 1. AI & Voice ── */}
          <SectionHeader title="AI & Voice" />
          <View style={cardStyle}>
            <LinkRow
              icon={<BarChart3 size={16} color="#FFFFFF" />}
              iconBg={ic.teal.fg}
              label="Voice Confidence"
              onPress={() => openSheet('voiceConfidence')}
            />
            <LinkRow
              icon={<Mic size={16} color="#FFFFFF" />}
              iconBg={ic.teal.fg}
              label="Test My Voice"
              onPress={() => openSheet('testVoice')}
            />
            <LinkRow
              icon={<Cpu size={16} color="#FFFFFF" />}
              iconBg={ic.indigo.fg}
              label="AI Providers"
              onPress={() => openSheet('aiProviders')}
            />
            <LinkRow
              icon={<Brain size={16} color="#FFFFFF" />}
              iconBg={ic.teal.fg}
              label="AI Learning"
              onPress={() => handleNavigate('aiLearning')}
              isLast
            />
          </View>
          <SectionFooter text={`${effectiveMessagesTrained > 0 ? effectiveMessagesTrained : 'No'} messages trained. The AI learns from your edits and approvals.`} />

          {/* ── 2. Messaging ── */}
          <SectionHeader title="Messaging" />
          <View style={cardStyle}>
            {hasPaidAutoPilot ? (
              <ToggleRow
                icon={<Plane size={16} color="#FFFFFF" />}
                iconBg={ic.orange.fg}
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
              />
            ) : (
              <LinkRow
                icon={<Plane size={16} color="#FFFFFF" />}
                iconBg={ic.orange.fg}
                label="Unlock Auto-Pilot"
                onPress={openAutoPilotUpgrade}
              />
            )}
            <ToggleRow
              icon={<Bell size={16} color="#FFFFFF" />}
              iconBg={ic.red.fg}
              label="Notifications"
              value={pushNotificationsEnabled}
              onValueChange={handlePushNotificationsToggle}
            />
            <LinkRow
              icon={<Zap size={16} color="#FFFFFF" />}
              iconBg={ic.purple.fg}
              label="Automations"
              onPress={() => openSheet('automations')}
              isLast
            />
          </View>
          {autoPilotEnabled && hasPaidAutoPilot && (
            <View style={{ paddingHorizontal: 16, marginTop: spacing['2'] }}>
              <View style={[s.card, { backgroundColor: t.bg.card, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                  <Text style={{ fontSize: 15, fontFamily: typography.fontFamily.regular, color: t.text.primary }}>Confidence Threshold</Text>
                  <Text style={{ fontSize: 15, fontFamily: typography.fontFamily.medium, color: t.primary.DEFAULT }}>{settings.autoPilotConfidenceThreshold}%</Text>
                </View>
                <Slider
                  minimumValue={50}
                  maximumValue={100}
                  step={5}
                  value={settings.autoPilotConfidenceThreshold}
                  onValueChange={(v) => updateSettings({ autoPilotConfidenceThreshold: Math.round(v) })}
                  minimumTrackTintColor={t.primary.DEFAULT}
                  maximumTrackTintColor={t.border.DEFAULT}
                  thumbTintColor={t.bg.base}
                  style={{ height: 28 }}
                />
              </View>
            </View>
          )}
          <SectionFooter text={
            hasPaidAutoPilot && autoPilotEnabled
              ? `Only trusted replies above ${settings.autoPilotConfidenceThreshold}% confidence are auto-sent.`
              : 'Control how messages are drafted and sent to guests.'
          } />

          {/* ── 3. Property & Data ── */}
          <SectionHeader title="Property & Data" />
          <View style={cardStyle}>
            <LinkRow
              icon={<BookOpen size={16} color="#FFFFFF" />}
              iconBg={ic.blue.fg}
              label="Property Knowledge"
              onPress={() => handleNavigate('propertyKnowledge')}
            />
            <LinkRow
              icon={<RefreshCw size={16} color="#FFFFFF" />}
              iconBg={ic.green.fg}
              label="Sync Data"
              onPress={() => openSheet('syncData')}
            />
            <LinkRow
              icon={<BarChart3 size={16} color="#FFFFFF" />}
              iconBg={ic.indigo.fg}
              label="Analytics"
              onPress={() => handleNavigate('analytics')}
              isLast
            />
          </View>

          {/* ── 4. Account ── */}
          <SectionHeader title="Account" />
          <View style={cardStyle}>
            <LinkRow
              icon={<HelpCircle size={16} color="#FFFFFF" />}
              iconBg={ic.blue.fg}
              label="Help Center"
              onPress={() => openSheet('helpCenter')}
            />
            <LinkRow
              icon={<Shield size={16} color="#FFFFFF" />}
              iconBg={ic.gray.fg}
              label="Privacy & Security"
              onPress={() => handleNavigate('privacySecurity')}
            />
            <LinkRow
              icon={<Key size={16} color="#FFFFFF" />}
              iconBg={ic.green.fg}
              label="API Settings"
              onPress={() => openSheet('apiSettings')}
              isLast
            />
          </View>

          {/* ── Sign Out ── */}
          <View style={{ marginTop: spacing['7'] }}>
            <View style={cardStyle}>
              <Pressable
                onPress={handleLogout}
                disabled={isDisconnecting}
                style={({ pressed }) => [sLocal.destructiveRow, { backgroundColor: pressed ? 'rgba(120,120,128,0.08)' : 'transparent' }]}
              >
                <View style={[s.iconBox, { backgroundColor: ic.red.fg }]}>
                  <LogOut size={16} color="#FFFFFF" />
                </View>
                <Text style={sLocal.destructiveText}>
                  {isDisconnecting ? 'Disconnecting...' : isDemoMode ? 'Exit Demo Mode' : 'Sign Out'}
                </Text>
                {isDisconnecting && <ActivityIndicator size="small" color={colors.danger.DEFAULT} />}
              </Pressable>
            </View>
          </View>

          {/* ── Delete My Data (separate card for emphasis) ── */}
          <View style={{ marginTop: spacing['3'] }}>
            <View style={cardStyle}>
              <Pressable
                onPress={handleDeleteMyData}
                disabled={isDeleting}
                style={({ pressed }) => [sLocal.destructiveRow, { backgroundColor: pressed ? 'rgba(120,120,128,0.08)' : 'transparent' }]}
              >
                <View style={[s.iconBox, { backgroundColor: ic.red.fg }]}>
                  <Trash2 size={16} color="#FFFFFF" />
                </View>
                <Text style={sLocal.destructiveText}>
                  {isDeleting ? 'Deleting...' : 'Delete My Data'}
                </Text>
                {isDeleting && <ActivityIndicator size="small" color={colors.danger.DEFAULT} />}
              </Pressable>
            </View>
            <SectionFooter text="Permanently deletes your voice profile and all training data from our servers." />
          </View>

          {/* ── Version ── */}
          <Text style={[sLocal.versionText, { color: t.text.disabled }]}>Rental Voice v1.0.0 ({BUILD_STAMP})</Text>

          <View style={{ height: spacing['12'] }} />

        </ScrollView>
      </SafeAreaView>

      {/* ── Bottom Sheets ── */}
      <SettingsBottomSheet
        visible={activeSheet === 'voiceConfidence'}
        onDismiss={() => setActiveSheet(null)}
      >
        <ConfidenceDetail onBack={() => setActiveSheet(null)} embedded />
      </SettingsBottomSheet>

      <SettingsBottomSheet
        visible={activeSheet === 'testVoice'}
        onDismiss={() => setActiveSheet(null)}
      >
        <TestVoiceScreen onBack={() => setActiveSheet(null)} embedded />
      </SettingsBottomSheet>

      <SettingsBottomSheet
        visible={activeSheet === 'aiProviders'}
        onDismiss={() => setActiveSheet(null)}
      >
        <AIProviderSettingsScreen onBack={() => setActiveSheet(null)} embedded />
      </SettingsBottomSheet>

      <SettingsBottomSheet
        visible={activeSheet === 'automations'}
        onDismiss={() => setActiveSheet(null)}
      >
        <AutomationsScreen onBack={() => setActiveSheet(null)} embedded />
      </SettingsBottomSheet>

      <SettingsBottomSheet
        visible={activeSheet === 'syncData'}
        onDismiss={() => setActiveSheet(null)}
      >
        <SyncDataScreen onBack={() => setActiveSheet(null)} embedded />
      </SettingsBottomSheet>

      <SettingsBottomSheet
        visible={activeSheet === 'helpCenter'}
        onDismiss={() => setActiveSheet(null)}
      >
        <HelpCenterScreen onBack={() => setActiveSheet(null)} embedded />
      </SettingsBottomSheet>

      <SettingsBottomSheet
        visible={activeSheet === 'apiSettings'}
        onDismiss={() => setActiveSheet(null)}
      >
        <ApiSettingsScreen onBack={() => setActiveSheet(null)} embedded />
      </SettingsBottomSheet>
    </View>
  );
}

/* ────────── Styles ────────── */

const sLocal = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7', // iOS system grouped background
  },
  header: {
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['2'],
    paddingBottom: spacing['1'],
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: typography.fontFamily.bold,
    color: '#000000',
    letterSpacing: 0.37,
  },
  scrollContent: {
    paddingBottom: spacing['4'],
  },
  // Profile header
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileEmail: {
    fontSize: 17,
    fontFamily: typography.fontFamily.semibold,
    color: '#000000',
    marginBottom: 3,
  },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary.muted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planBadgeText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary.DEFAULT,
  },
  // Destructive rows
  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    minHeight: 44,
  },
  destructiveText: {
    flex: 1,
    fontSize: 17,
    fontFamily: typography.fontFamily.regular,
    color: colors.danger.DEFAULT,
  },
  // Version
  versionText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 20,
  },
});
