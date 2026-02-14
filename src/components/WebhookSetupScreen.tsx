import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Webhook, Copy, CheckCircle, ExternalLink, AlertCircle, ChevronRight, Bell, Server, Shield } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useNotifications } from '@/lib/NotificationProvider';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface WebhookSetupScreenProps {
  onBack: () => void;
}

export function WebhookSetupScreen({ onBack }: WebhookSetupScreenProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { expoPushToken } = useNotifications();

  const webhookUrl = 'https://your-server.com/api/hostaway-webhook';

  const copyToClipboard = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openHostawayDashboard = () => {
    Linking.openURL('https://dashboard.hostaway.com/settings/webhooks');
  };

  const steps = [
    { number: 1, title: 'Log into Hostaway Dashboard', description: 'Go to Settings → Integrations → Webhooks in your Hostaway account.', action: { label: 'Open Hostaway Dashboard', onPress: openHostawayDashboard, icon: ExternalLink } },
    { number: 2, title: 'Create a New Webhook', description: 'Click "Add Webhook" and select "message.created" as the event type.' },
    { number: 3, title: 'Enter Webhook URL', description: 'Paste your webhook endpoint URL. This URL will receive new message notifications.', copyable: { label: 'Webhook URL', value: webhookUrl, field: 'webhookUrl' } },
    { number: 4, title: 'Save & Test', description: 'Save the webhook and test it by sending a test message from Hostaway.' },
  ];

  return (
    <View style={wh.root}>
      <LinearGradient colors={[colors.bg.elevated, colors.bg.subtle]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View entering={FadeIn.duration(300)} style={wh.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [wh.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={wh.title}>Webhook Setup</Text>
            <Text style={wh.subtitle}>Enable real-time notifications</Text>
          </View>
        </Animated.View>

        <ScrollView style={wh.scroll} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={wh.infoCard}>
            <View style={wh.row}>
              <View style={[wh.iconBox, { backgroundColor: colors.primary.muted }]}>
                <Bell size={20} color={colors.primary.DEFAULT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={wh.infoTitle}>Real-Time Notifications</Text>
                <Text style={wh.infoDesc}>Set up a webhook to receive instant push notifications when guests send new messages, even when the app is closed.</Text>
              </View>
            </View>
          </Animated.View>

          {/* Push Token */}
          {expoPushToken && (
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={wh.tokenCard}>
              <View style={[wh.rowCenter, { marginBottom: spacing['3'] }]}>
                <Server size={18} color={colors.text.muted} />
                <Text style={[wh.tokenLabel, { marginLeft: spacing['2'] }]}>Your Push Token</Text>
              </View>
              <Pressable onPress={() => copyToClipboard(expoPushToken, 'pushToken')} style={({ pressed }) => [wh.copyRow, { opacity: pressed ? 0.8 : 1 }]}>
                <Text style={wh.tokenText} numberOfLines={2}>{expoPushToken}</Text>
                {copiedField === 'pushToken' ? <CheckCircle size={18} color={colors.primary.DEFAULT} /> : <Copy size={18} color={colors.text.disabled} />}
              </Pressable>
              <Text style={wh.tokenHint}>Include this token in your webhook handler to send notifications to this device.</Text>
            </Animated.View>
          )}

          {/* Steps */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text style={wh.sectionLabel}>Setup Steps</Text>
            {steps.map((step, index) => (
              <View key={step.number} style={[wh.stepCard, index < steps.length - 1 ? { marginBottom: spacing['3'] } : { marginBottom: spacing['6'] }]}>
                <View style={wh.row}>
                  <View style={wh.stepNum}>
                    <Text style={wh.stepNumText}>{step.number}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={wh.stepTitle}>{step.title}</Text>
                    <Text style={wh.stepDesc}>{step.description}</Text>
                    {step.copyable && (
                      <Pressable onPress={() => copyToClipboard(step.copyable.value, step.copyable.field)} style={({ pressed }) => [wh.copyRow, { marginTop: spacing['3'], opacity: pressed ? 0.8 : 1 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={wh.copyLabel}>{step.copyable.label}</Text>
                          <Text style={wh.copyValue} numberOfLines={1}>{step.copyable.value}</Text>
                        </View>
                        {copiedField === step.copyable.field ? <CheckCircle size={18} color={colors.primary.DEFAULT} /> : <Copy size={18} color={colors.text.disabled} />}
                      </Pressable>
                    )}
                    {step.action && (
                      <Pressable onPress={step.action.onPress} style={({ pressed }) => [wh.actionBtn, { opacity: pressed ? 0.8 : 1 }]}>
                        <step.action.icon size={18} color={colors.accent.DEFAULT} />
                        <Text style={wh.actionText}>{step.action.label}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </Animated.View>

          {/* Technical Note */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={wh.noteCard}>
            <View style={wh.row}>
              <AlertCircle size={18} color={colors.text.disabled} />
              <View style={{ flex: 1, marginLeft: spacing['3'] }}>
                <Text style={wh.noteText}>
                  <Text style={{ fontFamily: typography.fontFamily.semibold }}>Note:</Text> For full push notification support, you'll need to set up a backend service (e.g., AWS Lambda, Vercel, or Firebase Functions) that receives Hostaway webhooks and sends Expo push notifications to your device.
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const wh = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.elevated + '80', alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  subtitle: { color: colors.text.muted, fontSize: 14 },
  scroll: { flex: 1, paddingHorizontal: spacing['4'] },
  infoCard: { backgroundColor: colors.primary.muted, borderWidth: 1, borderColor: colors.primary.soft, borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['6'] },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  infoTitle: { color: colors.primary.light, fontFamily: typography.fontFamily.semibold, marginBottom: 4 },
  infoDesc: { color: colors.text.secondary, fontSize: 14, lineHeight: 20 },
  tokenCard: { backgroundColor: colors.bg.elevated + 'B3', borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['6'] },
  tokenLabel: { color: colors.text.secondary, fontFamily: typography.fontFamily.medium },
  copyRow: { backgroundColor: colors.bg.hover + '80', borderRadius: radius.md, padding: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  tokenText: { color: colors.text.muted, fontSize: 12, flex: 1 },
  tokenHint: { color: colors.text.disabled, fontSize: 12, marginTop: spacing['2'] },
  sectionLabel: { color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing['3'], marginLeft: spacing['1'] },
  stepCard: { backgroundColor: colors.bg.elevated + '80', borderRadius: radius.xl, padding: spacing['4'] },
  stepNum: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.accent.muted, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  stepNumText: { color: colors.accent.light, fontFamily: typography.fontFamily.bold },
  stepTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, marginBottom: 4 },
  stepDesc: { color: colors.text.muted, fontSize: 14, lineHeight: 20 },
  copyLabel: { color: colors.text.disabled, fontSize: 12, marginBottom: 4 },
  copyValue: { color: colors.text.secondary, fontSize: 14 },
  actionBtn: { backgroundColor: colors.accent.muted, borderRadius: radius.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], marginTop: spacing['3'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionText: { color: colors.accent.light, fontFamily: typography.fontFamily.medium, marginLeft: spacing['2'] },
  noteCard: { backgroundColor: colors.bg.elevated + '4D', borderWidth: 1, borderColor: colors.border.subtle + '80', borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['8'] },
  noteText: { color: colors.text.muted, fontSize: 14, lineHeight: 20 },
});
