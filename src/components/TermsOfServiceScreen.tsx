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

export function TermsOfServiceScreen({ onBack, embedded }: Props) {
  const t = useThemeColors();
  const Wrapper = embedded ? View : SafeAreaView;

  return (
    <Wrapper style={[styles.container, { backgroundColor: t.bg.base }]} {...(!embedded && { edges: ['top'] })}>
      <View style={[styles.header, { borderBottomColor: t.border.subtle }]}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }} hitSlop={12}>
          <ArrowLeft size={24} color={t.text.primary} />
        </Pressable>
        <Text style={[styles.title, { color: t.text.primary }]}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.updated, { color: t.text.muted }]}>Effective: April 1, 2026</Text>

        <Text style={[styles.body, { color: t.text.secondary }]}>
          By using Rental Voice, you agree to these terms. Please read them carefully.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>1. Service Description</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          Rental Voice is an AI-powered guest messaging assistant for vacation rental hosts. The app generates draft responses to guest messages by learning your writing voice from your message history and edits.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>2. AI-Generated Content</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          AI drafts are suggestions, not final messages. You are responsible for reviewing, editing, and approving all messages before they are sent to guests. Rental Voice does not guarantee the accuracy, appropriateness, or completeness of AI-generated drafts. You should not rely on AI drafts for safety-critical information (emergency procedures, legal obligations, medical advice).
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>3. Your Account</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          You are responsible for maintaining the security of your account credentials and PMS API keys. You must not share your account with others or use the service for any unlawful purpose.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>4. PMS Integration</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          Rental Voice connects to your property management system (Hostaway) using credentials you provide. We access conversation history and booking data to generate drafts. You are responsible for ensuring you have the right to share this data with our service.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>5. Acceptable Use</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          You agree not to:{'\n'}
          {'\u2022'} Use the service to generate misleading, fraudulent, or harmful messages{'\n'}
          {'\u2022'} Attempt to reverse-engineer the AI voice learning system{'\n'}
          {'\u2022'} Exceed reasonable usage limits or abuse the service{'\n'}
          {'\u2022'} Use the service in violation of your PMS provider's terms
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>6. Intellectual Property</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          The Rental Voice app, AI models, and voice learning technology are our intellectual property. Your message content and voice profile data belong to you. We do not claim ownership of your messages or the AI drafts generated from your voice profile.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>7. Limitation of Liability</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          Rental Voice is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service, including but not limited to: incorrect AI drafts, messages sent in error, loss of data, or service interruptions. Our total liability is limited to the amount you paid for the service in the 12 months preceding the claim.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>8. Termination</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          You may stop using Rental Voice at any time and delete your data from Settings. We may suspend or terminate your account if you violate these terms. Upon termination, your data will be deleted per our Privacy Policy.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>9. Changes to Terms</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms.
        </Text>

        <Text style={[styles.heading, { color: t.text.primary }]}>10. Contact</Text>
        <Text style={[styles.body, { color: t.text.secondary }]}>
          Questions? Contact us at support@rentalvoice.app
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
});
