import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Switch, Alert, Share, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Lock, Eye, Trash2, Download, CheckCircle, Fingerprint, BarChart3, FileText, AlertTriangle, CloudOff } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAppStore } from '@/lib/store';
import { loadFounderSession, clearFounderSession } from '@/lib/secure-storage';
import { API_BASE_URL } from '@/lib/config';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface PrivacySecurityScreenProps { onBack: () => void; onNavigate?: (screen: string) => void; }

export function PrivacySecurityScreen({ onBack, onNavigate }: PrivacySecurityScreenProps) {
  const biometricLockEnabled = useAppStore((s) => s.settings.biometricLockEnabled);
  const analyticsEnabled = useAppStore((s) => s.settings.analyticsEnabled);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const conversations = useAppStore((s) => s.conversations);
  const properties = useAppStore((s) => s.properties);
  const resetStore = useAppStore((s) => s.resetStore);

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);

  const handleBiometricToggle = useCallback(async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (value) {
      // Check if biometric auth is available
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        Alert.alert('Not Available', 'Biometric authentication is not available on this device.');
        return;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        Alert.alert('Not Set Up', 'Please set up Face ID or Touch ID in your device settings first.');
        return;
      }

      // Authenticate to enable
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric lock',
        disableDeviceFallback: false,
      });

      if (result.success) {
        updateSettings({ biometricLockEnabled: true });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      updateSettings({ biometricLockEnabled: false });
    }
  }, [updateSettings]);

  const handleAnalyticsToggle = useCallback((value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSettings({ analyticsEnabled: value });
  }, [updateSettings]);

  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        summary: {
          totalConversations: conversations.length,
          totalProperties: properties.length,
        },
        properties: properties.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
        })),
        conversationCount: conversations.length,
        note: 'Full message content is not included for privacy. Contact support for a complete data export.',
      };

      const jsonString = JSON.stringify(exportData, null, 2);

      await Share.share({
        message: jsonString,
        title: 'Rental Voice Data Export',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      if ((error as { message?: string }).message !== 'User did not share') {
        Alert.alert('Export Failed', 'Unable to export your data. Please try again.');
      }
    } finally {
      setIsExporting(false);
    }
  }, [conversations, properties]);

  const handleDeleteData = useCallback(() => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your local data including conversations, properties, AI training data, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'All data will be permanently removed from this device.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete All',
                  style: 'destructive',
                  onPress: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    resetStore();
                    Alert.alert('Done', 'All local data has been deleted.');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [resetStore]);

  const handleDeleteCloudData = useCallback(() => {
    Alert.alert(
      'Delete Cloud Data',
      'Delete all cloud data? This removes your voice profile and learning history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Cloud Data',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingCloud(true);
            try {
              const session = await loadFounderSession();
              if (!session) {
                Alert.alert('No Cloud Account', 'No cloud account found. Your data is stored locally only.');
                setIsDeletingCloud(false);
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
                setIsDeletingCloud(false);
                return;
              }

              await clearFounderSession();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Done', 'All cloud data has been deleted.');
              console.log('[Privacy] Cloud data deleted');
            } catch (err) {
              console.error('[Privacy] Delete cloud data error:', err);
              Alert.alert('Deletion Failed', 'A network error occurred. Please try again.');
            } finally {
              setIsDeletingCloud(false);
            }
          },
        },
      ]
    );
  }, []);

  const features = [
    { icon: Lock, title: 'Secure Connections', desc: 'Data transmitted over encrypted HTTPS connections' },
    { icon: Shield, title: 'Secure Credential Storage', desc: 'PMS credentials stored using platform-native secure storage' },
    { icon: Eye, title: 'Privacy-First Design', desc: 'Your data is not sold to advertisers or data brokers' },
  ];

  return (
    <View style={s.root}>
      <LinearGradient colors={[colors.bg.elevated, colors.bg.subtle]} style={s.gradient} />
      <SafeAreaView style={s.flex} edges={['top']}>
        <Animated.View entering={FadeIn.duration(300)} style={s.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={s.title}>Privacy & Security</Text>
        </Animated.View>

        <ScrollView style={s.flex} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing['4'] }}>
          {/* Security Status Banner */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.banner}>
            <View style={s.bannerRow}>
              <View style={s.bannerIcon}>
                <Shield size={22} color={colors.primary.DEFAULT} />
              </View>
              <View style={s.flex}>
                <Text style={s.bannerTitle}>Privacy Settings</Text>
                <Text style={s.bannerDesc}>Manage your privacy and security preferences below.</Text>
              </View>
            </View>
          </Animated.View>

          {/* Security Features */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.section}>
            <Text style={s.label}>SECURITY FEATURES</Text>
            <View style={s.card}>
              {features.map((f, i) => (
                <View key={f.title} style={[s.row, i < features.length - 1 && s.border]}>
                  <View style={s.iconActive}><f.icon size={20} color={colors.primary.DEFAULT} /></View>
                  <View style={s.flex}>
                    <Text style={s.rowTitle}>{f.title}</Text>
                    <Text style={s.rowSub}>{f.desc}</Text>
                  </View>
                  <CheckCircle size={18} color={colors.primary.DEFAULT} />
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Privacy Controls */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={s.section}>
            <Text style={s.label}>PRIVACY CONTROLS</Text>
            <View style={s.card}>
              <View style={[s.row, s.border]}>
                <View style={s.iconNeutral}><Fingerprint size={20} color={colors.text.muted} /></View>
                <View style={s.flex}>
                  <Text style={s.rowTitle}>Biometric Lock</Text>
                  <Text style={s.rowSub}>Require Face ID or Touch ID to open app</Text>
                </View>
                <Switch
                  value={biometricLockEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                  thumbColor="#FFF"
                />
              </View>
              <View style={s.row}>
                <View style={s.iconNeutral}><BarChart3 size={20} color={colors.text.muted} /></View>
                <View style={s.flex}>
                  <Text style={s.rowTitle}>Usage Analytics</Text>
                  <Text style={s.rowSub}>Help improve the app (anonymous data only)</Text>
                </View>
                <Switch
                  value={analyticsEnabled}
                  onValueChange={handleAnalyticsToggle}
                  trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                  thumbColor="#FFF"
                />
              </View>
            </View>
          </Animated.View>

          {/* Data Management */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={s.section}>
            <Text style={s.label}>DATA MANAGEMENT</Text>
            <View style={s.card}>
              <Pressable
                onPress={handleExportData}
                disabled={isExporting}
                style={({ pressed }) => [s.row, s.border, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={s.iconNeutral}>
                  {isExporting
                    ? <ActivityIndicator size="small" color={colors.text.muted} />
                    : <Download size={20} color={colors.text.muted} />
                  }
                </View>
                <View style={s.flex}>
                  <Text style={s.rowTitle}>{isExporting ? 'Preparing Export…' : 'Export My Data'}</Text>
                  <Text style={s.rowSub}>Export a summary of your properties and usage data</Text>
                </View>
                <FileText size={16} color={colors.text.disabled} />
              </Pressable>
              <Pressable
                onPress={handleDeleteData}
                disabled={isDeleting}
                style={({ pressed }) => [s.row, s.border, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={[s.iconActive, { backgroundColor: colors.danger.muted }]}>
                  <Trash2 size={20} color={colors.danger.DEFAULT} />
                </View>
                <View style={s.flex}>
                  <Text style={[s.rowTitle, { color: colors.danger.light }]}>Reset App Data</Text>
                  <Text style={s.rowSub}>Clear local app data and preferences</Text>
                </View>
                <AlertTriangle size={16} color={colors.danger.DEFAULT} />
              </Pressable>
              <Pressable
                onPress={handleDeleteCloudData}
                disabled={isDeletingCloud}
                style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={[s.iconActive, { backgroundColor: colors.danger.muted }]}>
                  {isDeletingCloud
                    ? <ActivityIndicator size="small" color={colors.danger.DEFAULT} />
                    : <CloudOff size={20} color={colors.danger.DEFAULT} />
                  }
                </View>
                <View style={s.flex}>
                  <Text style={[s.rowTitle, { color: colors.danger.light }]}>
                    {isDeletingCloud ? 'Deleting...' : 'Delete My Cloud Data'}
                  </Text>
                  <Text style={s.rowSub}>Remove voice profile and learning history from servers</Text>
                </View>
                <AlertTriangle size={16} color={colors.danger.DEFAULT} />
              </Pressable>
            </View>
          </Animated.View>

          {/* Legal */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)} style={s.legal}>
            <Text style={s.legalText}>
              By using Rental Voice, you agree to our{' '}
              <Text style={{ color: colors.primary.light }} onPress={() => onNavigate?.('privacy-policy')}>Privacy Policy</Text> and{' '}
              <Text style={{ color: colors.primary.light }} onPress={() => onNavigate?.('terms-of-service')}>Terms of Service</Text>.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  flex: { flex: 1 },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, height: 150 },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: `${colors.bg.elevated}E6`,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  banner: {
    backgroundColor: `${colors.primary.DEFAULT}12`,
    borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['6'],
    borderWidth: 1, borderColor: `${colors.primary.DEFAULT}25`,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.primary.muted,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  bannerTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 16 },
  bannerDesc: { color: colors.text.muted, fontSize: 13, marginTop: 2 },
  section: { marginBottom: spacing['6'] },
  label: {
    color: colors.text.disabled, fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing['2'], marginLeft: spacing['1'],
  },
  card: {
    backgroundColor: `${colors.bg.elevated}E6`,
    borderRadius: radius['2xl'], overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing['4'], paddingVertical: spacing['4'],
  },
  border: { borderBottomWidth: 1, borderBottomColor: `${colors.border.DEFAULT}50` },
  iconActive: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.primary.muted,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  iconNeutral: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: `${colors.bg.elevated}CC`,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  rowTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 15 },
  rowSub: { color: colors.text.disabled, fontSize: 13, marginTop: 2 },
  legal: {
    backgroundColor: `${colors.bg.elevated}4D`,
    borderRadius: radius.md, padding: spacing['4'], marginBottom: spacing['8'],
  },
  legalText: { color: colors.text.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
