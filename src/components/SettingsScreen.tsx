import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Switch, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import { disconnectHostaway } from '@/lib/hostaway';
import { useNotifications } from '@/lib/NotificationProvider';
import { getNotificationPermissionStatus } from '@/lib/notifications';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import {
  ArrowLeft,
  Sparkles,
  Key,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  MessageSquare,
  Database,
  BookOpen,
  Calendar,
  AlertTriangle,
  BarChart3,
  DollarSign,
  Globe,
  Brain,
  Unlink,
  Radio,
  ScanLine,
  Heart,
  Copy,
  Check,
  BellOff,
  Smartphone,
  RefreshCw,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onNavigate?: (screen: string) => void;
}

export function SettingsScreen({ onBack, onLogout, onNavigate }: SettingsScreenProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [isPhysicalDevice, setIsPhysicalDevice] = useState(true);

  const pushNotificationsEnabled = useAppStore((s) => s.settings.pushNotificationsEnabled);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const analytics = useAppStore((s) => s.analytics);
  const issues = useAppStore((s) => s.issues);

  const { isRegistered, registerForNotifications, expoPushToken, isLoadingToken, tokenError, refreshToken } = useNotifications();

  const openIssues = issues.filter((i) => i.status !== 'resolved').length;

  // Check permission status and device type on load
  useEffect(() => {
    async function checkStatus() {
      setIsPhysicalDevice(Device.isDevice);
      const status = await getNotificationPermissionStatus();
      setPermissionStatus(status);
    }
    checkStatus();
  }, []);

  const handleEnableNotifications = async () => {
    setIsRequestingPermission(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await registerForNotifications();
      const status = await getNotificationPermissionStatus();
      setPermissionStatus(status);

      if (status === 'granted') {
        updateSettings({ pushNotificationsEnabled: true });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (status === 'denied') {
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in your device settings to receive message alerts.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[Settings] Error requesting notifications:', error);
      Alert.alert('Error', 'Failed to enable notifications. Please try again.');
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleCopyToken = async () => {
    if (expoPushToken) {
      await Clipboard.setStringAsync(expoPushToken);
      setTokenCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const handleRefreshToken = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refreshToken();
  };

  const handlePushNotificationsToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (value) {
      // Check permission status first
      const status = await getNotificationPermissionStatus();
      if (status === 'denied') {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device settings to receive message alerts.',
          [{ text: 'OK' }]
        );
        return;
      }
      // Register for notifications
      await registerForNotifications();
    }

    updateSettings({ pushNotificationsEnabled: value });
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Hostaway',
      'This will remove your saved credentials. You will need to re-enter them to reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setIsDisconnecting(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            try {
              // Clear secure storage credentials
              await disconnectHostaway();
              // Reset app store
              onLogout();
            } catch (error) {
              console.error('[Settings] Failed to disconnect:', error);
              Alert.alert('Error', 'Failed to disconnect. Please try again.');
            } finally {
              setIsDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    if (isDemoMode) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onLogout();
    } else {
      handleDisconnect();
    }
  };

  const handleNavigate = (screen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigate?.(screen);
  };

  const sections = [
    {
      title: 'Notifications',
      items: [
        {
          icon: Bell,
          label: 'Push Notifications',
          description: isRegistered
            ? 'Get notified when guests message you'
            : 'Enable to receive message alerts',
          type: 'toggle' as const,
          value: pushNotificationsEnabled,
          onToggle: handlePushNotificationsToggle,
        },
        {
          icon: Radio,
          label: 'Webhook Setup',
          description: 'Configure real-time message alerts',
          type: 'link' as const,
          screen: 'webhookSetup',
        },
        {
          icon: Bell,
          label: 'Notification Categories',
          description: 'Quiet hours, per-property muting & categories',
          type: 'link' as const,
          screen: 'notificationSettings',
        },
      ],
    },
    {
      title: 'AI Settings',
      items: [
        {
          icon: Key,
          label: 'AI Providers',
          description: 'Manage API keys & provider priority',
          type: 'link' as const,
          screen: 'aiProviders',
        },
        {
          icon: Sparkles,
          label: 'AI Automation',
          description: 'CoPilot & AutoPilot modes, scheduling, escalation',
          type: 'link' as const,
          screen: 'autoPilotSettings',
        },
        {
          icon: Brain,
          label: 'AI Learning',
          description: 'Train AI to match your style',
          type: 'link' as const,
          screen: 'aiLearning',
        },
        {
          icon: Heart,
          label: 'Sentiment Trends',
          description: 'Guest sentiment analysis and insights',
          type: 'link' as const,
          screen: 'sentimentTrends',
        },
      ],
    },
    {
      title: 'Features',
      items: [
        {
          icon: BookOpen,
          label: 'Property Knowledge',
          description: 'WiFi, check-in, rules, and more',
          type: 'link' as const,
          screen: 'propertyKnowledge',
        },
        {
          icon: Calendar,
          label: 'Automations',
          description: 'Scheduled messages and workflows',
          type: 'link' as const,
          screen: 'automations',
        },
        {
          icon: AlertTriangle,
          label: 'Issue Tracker',
          description: openIssues > 0 ? `${openIssues} open issues` : 'No open issues',
          type: 'link' as const,
          screen: 'issueTracker',
          badge: openIssues > 0 ? openIssues : undefined,
        },
        {
          icon: BarChart3,
          label: 'Analytics',
          description: `${analytics.totalMessagesHandled} messages handled`,
          type: 'link' as const,
          screen: 'analytics',
        },
        {
          icon: DollarSign,
          label: 'Upsells',
          description: `$${analytics.upsellRevenue} earned`,
          type: 'link' as const,
          screen: 'upsells',
        },
      ],
    },
    {
      title: 'Connection',
      items: [
        {
          icon: Key,
          label: 'Hostaway API',
          description: isDemoMode ? 'Using demo mode' : 'Connected',
          type: 'link' as const,
          status: isDemoMode ? 'demo' : 'connected',
          screen: 'apiSettings',
        },
        {
          icon: Database,
          label: 'Sync Data',
          description: 'Last synced: Just now',
          type: 'link' as const,
          screen: 'syncData',
        },
        {
          icon: Globe,
          label: 'Language',
          description: 'Auto-detect guest language',
          type: 'link' as const,
          screen: 'languageSettings',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: HelpCircle,
          label: 'Help Center',
          description: 'FAQs and guides',
          type: 'link' as const,
          screen: 'helpCenter',
        },
        {
          icon: Shield,
          label: 'Privacy & Security',
          description: 'Your data is encrypted end-to-end',
          type: 'link' as const,
          screen: 'privacySecurity',
        },
        {
          icon: ScanLine,
          label: 'Privacy Compliance',
          description: 'Scan drafts, reports & data export',
          type: 'link' as const,
          screen: 'privacyCompliance',
        },
      ],
    },
  ];

  return (
    <View style={settingsStyles.root}>
      <LinearGradient
        colors={[colors.bg.elevated, colors.bg.subtle]}
        style={settingsStyles.headerGradient}
      />

      <SafeAreaView style={settingsStyles.flex1} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={settingsStyles.header}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [settingsStyles.backButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={settingsStyles.headerTitle}>Settings</Text>
        </Animated.View>

        <ScrollView style={settingsStyles.flex1} showsVerticalScrollIndicator={false}>
          {sections.map((section, sectionIndex) => (
            <Animated.View
              key={section.title}
              entering={FadeInDown.delay((sectionIndex + 1) * 100).duration(400)}
              style={settingsStyles.sectionWrap}
            >
              <Text style={settingsStyles.sectionTitle}>
                {section.title}
              </Text>
              <View style={settingsStyles.sectionCard}>
                {section.items.map((item, itemIndex) => (
                  <Pressable
                    key={item.label}
                    onPress={() => {
                      if (item.type === 'link' && 'screen' in item && item.screen) {
                        handleNavigate(item.screen);
                      }
                    }}
                    style={({ pressed }) => [
                      settingsStyles.itemRow,
                      itemIndex < section.items.length - 1 && settingsStyles.itemBorder,
                      { opacity: item.type === 'link' && pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        settingsStyles.iconWrap,
                        {
                          backgroundColor:
                            item.type === 'toggle' && item.value
                              ? colors.primary.muted
                              : `${colors.bg.elevated}CC`,
                        },
                      ]}
                    >
                      <item.icon
                        size={16}
                        color={item.type === 'toggle' && item.value ? colors.primary.DEFAULT : colors.text.muted}
                      />
                    </View>

                    <View style={settingsStyles.flex1}>
                      <Text style={settingsStyles.itemLabel}>{item.label}</Text>
                      <Text style={settingsStyles.itemDesc}>{item.description}</Text>
                    </View>

                    {item.type === 'toggle' && (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                        thumbColor="#FFFFFF"
                      />
                    )}

                    {item.type === 'link' && (
                      <View style={settingsStyles.linkRight}>
                        {'badge' in item && item.badge !== undefined && (
                          <View style={settingsStyles.badgeWrap}>
                            <Text style={settingsStyles.badgeText}>{item.badge}</Text>
                          </View>
                        )}
                        {'status' in item && item.status === 'demo' && (
                          <View style={settingsStyles.demoBadge}>
                            <Text style={settingsStyles.demoBadgeText}>Demo</Text>
                          </View>
                        )}
                        {'status' in item && item.status === 'connected' && (
                          <View style={settingsStyles.connectedBadge}>
                            <Text style={settingsStyles.connectedBadgeText}>Connected</Text>
                          </View>
                        )}
                        <ChevronRight size={18} color={colors.text.disabled} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ))}

          {/* Logout Button */}
          <Animated.View
            entering={FadeInDown.delay(600).duration(400)}
            style={settingsStyles.logoutWrap}
          >
            <Pressable
              onPress={handleLogout}
              disabled={isDisconnecting}
              style={({ pressed }) => [
                settingsStyles.logoutBtn,
                {
                  backgroundColor: isDisconnecting ? `${colors.bg.elevated}80` : colors.danger.muted,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {isDisconnecting ? (
                <>
                  <ActivityIndicator size="small" color={colors.text.muted} />
                  <Text style={settingsStyles.logoutTextDisabled}>Disconnecting...</Text>
                </>
              ) : (
                <>
                  <LogOut size={20} color={colors.danger.DEFAULT} />
                  <Text style={settingsStyles.logoutText}>
                    {isDemoMode ? 'Exit Demo Mode' : 'Disconnect Hostaway'}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Version */}
          <View style={settingsStyles.versionWrap}>
            <Text style={settingsStyles.versionText}>Rental Voice v1.0.0</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const settingsStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  flex1: {
    flex: 1,
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 150,
  },
  header: {
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: `${colors.bg.elevated}E6`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
  },
  sectionWrap: {
    paddingHorizontal: spacing['4'],
    marginBottom: spacing['6'],
  },
  sectionTitle: {
    color: colors.text.disabled,
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing['2'],
    marginLeft: spacing['1'],
  },
  sectionCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['3'],
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border.DEFAULT}50`,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  itemLabel: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 15,
  },
  itemDesc: {
    color: colors.text.disabled,
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    marginTop: 2,
  },
  linkRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeWrap: {
    backgroundColor: colors.danger.muted,
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
    borderRadius: radius.full,
    marginRight: spacing['2'],
  },
  badgeText: {
    color: colors.danger.light,
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
  },
  demoBadge: {
    backgroundColor: colors.accent.muted,
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
    borderRadius: radius.full,
    marginRight: spacing['2'],
  },
  demoBadgeText: {
    color: colors.accent.light,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
  connectedBadge: {
    backgroundColor: colors.primary.muted,
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
    borderRadius: radius.full,
    marginRight: spacing['2'],
  },
  connectedBadgeText: {
    color: colors.primary.light,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
  logoutWrap: {
    paddingHorizontal: spacing['4'],
    marginBottom: spacing['8'],
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    paddingVertical: spacing['4'],
  },
  logoutText: {
    color: colors.danger.DEFAULT,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 15,
    marginLeft: spacing['2'],
  },
  logoutTextDisabled: {
    color: colors.text.muted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 15,
    marginLeft: spacing['2'],
  },
  versionWrap: {
    alignItems: 'center',
    paddingBottom: spacing['8'],
  },
  versionText: {
    color: colors.text.disabled,
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
  },
});
