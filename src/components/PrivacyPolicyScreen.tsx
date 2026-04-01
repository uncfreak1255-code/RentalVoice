import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { colors, typography, spacing } from '@/lib/design-tokens';
import { useThemeColors } from '@/lib/useThemeColors';
import * as Haptics from 'expo-haptics';

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

export function PrivacyPolicyScreen({ onBack, embedded }: Props) {
  const t = useThemeColors();
  const Wrapper = embedded ? View : SafeAreaView;

  return (
    <Wrapper style={[styles.container, { backgroundColor: t.bg.base }]} {...(!embedded && { edges: ['top'] })}>
      <View style={[styles.header, { borderBottomColor: t.border.subtle }]}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }} hitSlop={12}>
          <ArrowLeft size={24} color={t.text.primary} />
        </Pressable>
        <Text style={[styles.title, { color: t.text.primary }]}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.updated, { color: t.text.muted }]}>Effective: April 1, 2026</Text>

        <Text style={[styles.body, { color: t.text.secondary }]}>
          Rental Voice ("we", "our", "us") operates the Rental Voice mobile application. This Privacy Policy explains how we collect, use, and protect your information.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>Information We Collect</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          <Text style={styles.bold}>Account Information:</Text> Your email address and name when you create an account.{'\n\n'}
          <Text style={styles.bold}>PMS Credentials:</Text> Your Hostaway Account ID and API key, used to connect to your property management system. These are encrypted at rest and never shared.{'\n\n'}
          <Text style={styles.bold}>Guest Messages:</Text> Conversation data from your PMS, used to generate AI draft responses and learn your writing voice. Messages are processed by Google's Gemini AI to generate drafts.{'\n\n'}
          <Text style={styles.bold}>Usage Data:</Text> How you interact with AI drafts (approvals, edits, dismissals) to improve voice matching accuracy.{'\n\n'}
          <Text style={styles.bold}>Device Information:</Text> Device type and anonymous identifiers for analytics and crash reporting via Expo.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>How We Use Your Information</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          {'\u2022'} Generate AI draft responses that match your writing voice{'\n'}
          {'\u2022'} Learn from your edits to improve future drafts{'\n'}
          {'\u2022'} Sync your voice profile across devices{'\n'}
          {'\u2022'} Provide customer support{'\n'}
          {'\u2022'} Improve the app's accuracy and performance
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>Third-Party Services</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          <Text style={styles.bold}>Google AI (Gemini):</Text> We send guest messages and conversation context to Google's Gemini API to generate draft responses. Google's AI data usage policy applies to this processing.{'\n\n'}
          <Text style={styles.bold}>Supabase:</Text> Your account data, voice profile, and learning history are stored in Supabase (PostgreSQL). Data is encrypted at rest.{'\n\n'}
          <Text style={styles.bold}>Langfuse:</Text> We use Langfuse for AI observability to monitor draft quality. Conversation context may be included in traces.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>Data Storage and Security</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          Your data is stored on secure servers with encryption at rest. PMS API keys are encrypted using AES-256 before storage. We use HTTPS for all data transmission.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>Your Rights</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          <Text style={styles.bold}>Access:</Text> You can view your data through the app.{'\n\n'}
          <Text style={styles.bold}>Deletion:</Text> You can delete all your cloud data at any time from Settings {'>'} Privacy {'&'} Security {'>'} Delete My Cloud Data. This permanently removes your voice profile, learning history, and account information.{'\n\n'}
          <Text style={styles.bold}>Portability:</Text> Contact us to request an export of your data.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>Data Retention</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          We retain your data for as long as your account is active. When you delete your data, it is permanently removed from our servers within 30 days.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>Children's Privacy</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          Rental Voice is not intended for use by anyone under the age of 13. We do not knowingly collect personal information from children.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>Changes to This Policy</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          We may update this policy from time to time. We will notify you of material changes through the app or by email.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>Contact Us</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          Questions about this policy? Contact us at support@rentalvoice.app
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['4'], paddingVertical: spacing['2'], borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontFamily: typography.fontFamily.semibold },
  scroll: { flex: 1 },
  content: { padding: spacing['5'] },
  updated: { fontSize: 13, marginBottom: spacing['5'] },
  heading: { fontSize: 16, fontFamily: typography.fontFamily.semibold, marginTop: spacing['6'], marginBottom: spacing['2'] },
  body: { fontSize: 15, lineHeight: 22, marginBottom: spacing['3'] },
  bold: { fontFamily: typography.fontFamily.semibold },
});
