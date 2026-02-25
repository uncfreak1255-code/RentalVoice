import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useAppStore } from '@/lib/store';
import { disconnectHostaway } from '@/lib/hostaway';
import { useNotifications } from '@/lib/NotificationProvider';
import {
  Wifi, Key, Bell, Shield, LogOut,
  Brain, BookOpen, Calendar,
  BarChart3, DollarSign, BellOff, Heart,
  Plane, MessageSquare, Cpu, FileText, Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '@/lib/design-tokens';
import { SectionHeader, SectionFooter, Row, ToggleRow, ValueRow, LinkRow, s } from './ui/SettingsComponents';
import { getUsageStats, type UsageStats } from '@/lib/ai-usage-limiter';

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
  const aiLearningProgress = useAppStore((s) => s.aiLearningProgress);

  // AI Usage stats
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  useEffect(() => {
    getUsageStats().then(setUsageStats).catch(console.error);
  }, []);

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
            if (!isDemoMode) await disconnectHostaway();
            onLogout();
          },
        },
      ]
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
              label="API Status"
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
              label="Configure API Keys"
              onPress={() => handleNavigate('apiSettings')}
              isLast
            />
          </View>

          {/* ── AI Usage ── */}
          <SectionHeader title="AI Usage" />
          <View style={s.card}>
            <Row
              icon={<Zap size={18} color={colors.primary.DEFAULT} />}
              label="Drafts Today"
              right={
                <Text style={s.tealValue}>
                  {usageStats ? `${usageStats.draftsToday} / ${usageStats.dailyLimit}` : '–'}
                </Text>
              }
            />
            {usageStats && (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <View style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: 6,
                    borderRadius: 3,
                    width: `${Math.min(usageStats.dailyPercentage, 100)}%`,
                    backgroundColor: usageStats.dailyPercentage < 70 ? colors.primary.DEFAULT
                      : usageStats.dailyPercentage < 90 ? '#F59E0B' : '#EF4444',
                  }} />
                </View>
              </View>
            )}
            <ValueRow
              icon={<Cpu size={18} color={colors.primary.DEFAULT} />}
              label="Model"
              value="Gemini Flash"
            />
            <ValueRow
              icon={<BarChart3 size={18} color={colors.primary.DEFAULT} />}
              label="This Month"
              value={usageStats ? `${usageStats.draftsThisMonth} drafts` : '–'}
              isLast
            />
          </View>
          <SectionFooter text={`${usageStats?.tierLabel || 'Starter'} plan • Resets daily at midnight`} />

          {/* ── Auto-Pilot ── */}
          <SectionHeader title="Auto-Pilot" />
          <View style={s.card}>
            <ToggleRow
              icon={<Plane size={18} color={colors.primary.DEFAULT} />}
              label="Auto-Pilot Mode"
              value={autoPilotEnabled}
              onValueChange={(v) => {
                if (v) {
                  Alert.alert('Enable AutoPilot', 'High-confidence AI drafts will be sent automatically.', [
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
          </View>
          <SectionFooter text={autoPilotEnabled
            ? `Drafts above ${settings.autoPilotConfidenceThreshold}% confidence will be sent automatically.`
            : 'When enabled, high-confidence AI drafts are sent without manual review.'
          } />

          {/* ── AI Learning ── */}
          <SectionHeader title="AI Learning" />
          <View style={s.card}>
            <ToggleRow
              icon={<Brain size={18} color={colors.primary.DEFAULT} />}
              label="Style Learning"
              value={settings.culturalToneEnabled !== false}
              onValueChange={(v) => updateSettings({ culturalToneEnabled: v })}
            />
            <ValueRow
              icon={<MessageSquare size={18} color={colors.primary.DEFAULT} />}
              label="Messages Analyzed"
              value={String(aiLearningProgress?.totalMessagesAnalyzed || analytics.totalMessagesHandled || 0)}
            />
            <ValueRow
              icon={<BarChart3 size={18} color={colors.primary.DEFAULT} />}
              label="Style Confidence"
              value={`${aiLearningProgress?.accuracyScore || 0}%`}
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
              label="Urgent Only"
              value={settings.notificationCategories?.newMessage === false}
              onValueChange={(v) => updateSettings({ notificationCategories: { ...settings.notificationCategories, newMessage: !v } })}
              isLast
            />
          </View>

          {/* ── Features ── */}
          <SectionHeader title="Features" />
          <View style={s.card}>
            <Row
              icon={<Calendar size={18} color={colors.primary.DEFAULT} />}
              label="Automations"
              onPress={() => handleNavigate('automations')}
            />
            <Row
              icon={<Heart size={18} color={colors.primary.DEFAULT} />}
              label="Sentiment Trends"
              onPress={() => handleNavigate('sentimentTrends')}
            />
            <Row
              icon={<BarChart3 size={18} color={colors.primary.DEFAULT} />}
              label="Analytics"
              right={<Text style={s.rowValue}>{analytics.totalMessagesHandled}</Text>}
              onPress={() => handleNavigate('analytics')}
            />
            <Row
              icon={<DollarSign size={18} color={colors.primary.DEFAULT} />}
              label="Upsells"
              right={<Text style={s.rowValue}>${analytics.upsellRevenue}</Text>}
              onPress={() => handleNavigate('upsells')}
              isLast
            />
          </View>

          {/* ── About ── */}
          <SectionHeader title="About" />
          <View style={s.card}>
            <ValueRow
              icon={<Shield size={18} color={colors.primary.DEFAULT} />}
              label="Version"
              value="1.0.0"
            />
            <LinkRow
              icon={<Shield size={18} color={colors.primary.DEFAULT} />}
              label="Privacy Policy"
              onPress={() => handleNavigate('privacySecurity')}
            />
            <LinkRow
              icon={<FileText size={18} color={colors.primary.DEFAULT} />}
              label="Terms of Service"
              onPress={() => handleNavigate('privacyCompliance')}
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
