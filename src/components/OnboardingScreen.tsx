import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MessageSquare, Key, ArrowRight, Sparkles, Shield, Zap, User, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore, type Conversation, type Guest, type PMSProvider } from '@/lib/store';
import { demoConversations, demoProperties } from '@/lib/mockData';
import { validateCredentials, fetchListings, fetchConversations, fetchMessages, fetchReservation, extractGuestName, initializeConnection, fetchListingDetail } from '@/lib/hostaway';
import { convertListingToProperty, getChannelPlatform, convertHostawayMessage } from '@/lib/hostaway-utils';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import { startAutoImportAfterConnect } from '@/lib/auto-import';

const PMS_OPTIONS: { key: PMSProvider; name: string; color: string; subtitle: string; fieldId: string; fieldKey: string; comingSoon?: boolean }[] = [
  { key: 'hostaway', name: 'Hostaway', color: '#14B8A6', subtitle: 'Enter your Hostaway credentials to sync properties and conversations', fieldId: 'Account ID', fieldKey: 'API Key' },
  { key: 'guesty', name: 'Guesty', color: '#6366F1', subtitle: 'Enter your Guesty API token to sync properties and conversations', fieldId: 'Account ID', fieldKey: 'API Token' },
  { key: 'lodgify', name: 'Lodgify', color: '#F59E0B', subtitle: 'Lodgify integration coming soon', fieldId: 'Property ID', fieldKey: 'API Key', comingSoon: true },
];

interface OnboardingScreenProps { onComplete: () => void; }

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const progress = useSharedValue(0);

  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const setDemoMode = useAppStore((s) => s.setDemoMode);
  const setCredentials = useAppStore((s) => s.setCredentials);
  const setConversations = useAppStore((s) => s.setConversations);
  const setProperties = useAppStore((s) => s.setProperties);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setPropertyKnowledge = useAppStore((s) => s.setPropertyKnowledge);
  const [selectedPms, setSelectedPms] = useState<PMSProvider>('hostaway');
  const pmsConfig = PMS_OPTIONS.find((p) => p.key === selectedPms) || PMS_OPTIONS[0];

  useEffect(() => { progress.value = withSpring((step + 1) / 3, { damping: 15 }); }, [step, progress]);

  const handleStartDemo = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDemoMode(true); setConversations(demoConversations); setProperties(demoProperties); setOnboarded(true); onComplete();
  };

  const handleConnectHostaway = async () => {
    if (!accountId.trim() || !apiKey.trim()) return;
    setIsValidating(true); setError(null); setStatusMessage('Validating credentials...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const isValid = await validateCredentials(accountId.trim(), apiKey.trim());
      if (!isValid) { setError('Invalid credentials. Please check your Account ID and API Key.'); setIsValidating(false); setStatusMessage(null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
      setStatusMessage('Fetching your properties...');
      const listings = await fetchListings(accountId.trim(), apiKey.trim());
      const properties = listings.map(convertListingToProperty);

      // ── Auto-import Knowledge Base from listing details ──
      setStatusMessage('Importing property knowledge...');
      const { extractKnowledgeFromListing } = await import('@/lib/listing-import');
      for (const listing of listings) {
        try {
          const detail = await fetchListingDetail(accountId.trim(), apiKey.trim(), listing.id);
          const property = properties.find((p) => p.id === String(listing.id));
          if (property && detail) {
            const { extracted } = extractKnowledgeFromListing(property, undefined, detail);
            if (Object.keys(extracted).length > 1) { // more than just propertyId
              setPropertyKnowledge(String(listing.id), {
                propertyId: String(listing.id),
                propertyType: 'vacation_rental',
                ...extracted,
              });
              console.log(`[KB] Auto-imported ${Object.keys(extracted).length} fields for ${property.name}`);
            }
          }
        } catch (err) {
          console.warn(`[KB] Failed to import knowledge for listing ${listing.id}:`, err);
        }
      }

      setStatusMessage('Fetching conversations...');
      const hostawayConvos = await fetchConversations(accountId.trim(), apiKey.trim());
      setStatusMessage('Loading messages...');
      const conversations: Conversation[] = [];
      for (const conv of hostawayConvos.slice(0, 20)) {
        try {
          const messages = await fetchMessages(accountId.trim(), apiKey.trim(), conv.id);
          const property = properties.find((p) => p.id === String(conv.listingMapId)) || { id: String(conv.listingMapId), name: conv.listingName || 'Unknown Property', address: '' };
          let guestName = extractGuestName(conv);
          if (guestName === 'Unknown Guest' && conv.reservationId) {
            const reservation = await fetchReservation(accountId.trim(), apiKey.trim(), conv.reservationId);
            if (reservation) { const rn = reservation.guestName || `${reservation.guestFirstName || ''} ${reservation.guestLastName || ''}`.trim(); if (rn) guestName = rn; }
          }
          const guest: Guest = { id: String(conv.id), name: guestName, avatar: conv.guestPicture || conv.guest?.picture, email: conv.guestEmail || conv.guest?.email, phone: conv.guestPhone || conv.guest?.phone };
          const converted = messages.map((m) => convertHostawayMessage(m, String(conv.id))).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          conversations.push({ id: String(conv.id), guest, property, messages: converted, lastMessage: converted[converted.length - 1], unreadCount: conv.isRead ? 0 : 1, status: conv.isArchived ? 'archived' : 'active', checkInDate: conv.arrivalDate ? new Date(conv.arrivalDate) : undefined, checkOutDate: conv.departureDate ? new Date(conv.departureDate) : undefined, platform: getChannelPlatform(conv.channelName), hasAiDraft: false });
        } catch {} // skip individual conversation errors
      }
      await initializeConnection(accountId.trim(), apiKey.trim());
      setCredentials(accountId.trim(), apiKey.trim()); setDemoMode(false); setProperties(properties); setConversations(conversations); setOnboarded(true);
      updateSettings({ pmsProvider: selectedPms });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setStatusMessage(null); setIsValidating(false);
      // Auto-start 12-month history import + AI training in background
      startAutoImportAfterConnect(accountId.trim(), apiKey.trim());
      onComplete();
    } catch (err) {
      console.error('[Onboarding]', err); setError('Failed to connect to Hostaway. Please try again.'); setStatusMessage(null); setIsValidating(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const nextStep = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep((s) => Math.min(s + 1, 2)); };
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const hasInput = accountId.trim() && apiKey.trim();

  const features = [
    { icon: MessageSquare, title: 'Unified Inbox', desc: 'All your guest messages in one place' },
    { icon: Sparkles, title: 'AI-Powered Replies', desc: 'Drafts that match your style perfectly' },
    { icon: Zap, title: 'Auto-Pilot Mode', desc: 'Automated responses for trusted scenarios' },
  ];

  return (
    <View style={ob.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.elevated, colors.bg.subtle]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={ob.progressWrap}><View style={ob.progressBg}><Animated.View style={[ob.progressBar, progressStyle]} /></View></View>

        {step === 0 && (
          <Animated.View entering={FadeIn.duration(500)} style={ob.stepWrap}>
            <Animated.View entering={FadeInDown.delay(200).duration(600)} style={ob.logoWrap}>
              <View style={ob.logoBox}><MessageSquare size={40} color="#FFF" /></View>
              <Text style={ob.heroTitle}>Rental Voice</Text>
              <Text style={ob.heroSub}>Smart guest communication for vacation rentals</Text>
            </Animated.View>
            <View style={{ marginTop: spacing['8'] }}>
              {features.map((f, i) => (
                <Animated.View key={f.title} entering={FadeInDown.delay(400 + i * 150).duration(500)} style={ob.featureRow}>
                  <View style={ob.featureIcon}><f.icon size={24} color={colors.accent.DEFAULT} /></View>
                  <View style={{ flex: 1, marginLeft: spacing['4'] }}>
                    <Text style={ob.featureTitle}>{f.title}</Text>
                    <Text style={ob.featureSub}>{f.desc}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
            <View style={ob.ctaWrap}>
              <Animated.View entering={FadeInUp.delay(800).duration(500)}>
                <Pressable onPress={nextStep} style={({ pressed }) => [ob.ctaBtn, { opacity: pressed ? 0.9 : 1 }]}>
                  <Text style={ob.ctaText}>Get Started</Text><ArrowRight size={20} color="#FFF" />
                </Pressable>
              </Animated.View>
            </View>
          </Animated.View>
        )}

        {step === 1 && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
              <Animated.View entering={SlideInRight.duration(400)} style={ob.stepWrap}>
                <View style={ob.logoWrap}>
                  <View style={ob.keyBox}><Key size={32} color={colors.primary.DEFAULT} /></View>
                  <Text style={ob.stepTitle}>Connect Your PMS</Text>
                  <Text style={ob.stepSub}>{pmsConfig.subtitle}</Text>
                </View>
                {/* PMS Provider Pills */}
                <View style={{ flexDirection: 'row', gap: spacing['2'], marginBottom: spacing['4'] }}>
                  {PMS_OPTIONS.map((p) => (
                    <Pressable
                      key={p.key}
                      onPress={() => { if (!p.comingSoon) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedPms(p.key); setError(null); } }}
                      style={({ pressed }) => ({
                        flex: 1, paddingVertical: spacing['3'], borderRadius: radius.md, alignItems: 'center' as const,
                        backgroundColor: selectedPms === p.key ? p.color + '20' : colors.bg.elevated + '80',
                        borderWidth: selectedPms === p.key ? 1.5 : 1,
                        borderColor: selectedPms === p.key ? p.color : colors.border.subtle,
                        opacity: p.comingSoon ? 0.4 : pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ color: selectedPms === p.key ? p.color : colors.text.muted, fontFamily: typography.fontFamily.medium, fontSize: 13 }}>{p.name}</Text>
                      {p.comingSoon && <Text style={{ color: colors.text.disabled, fontSize: 10, marginTop: 2 }}>Soon</Text>}
                    </Pressable>
                  ))}
                </View>
                <View style={ob.inputCard}><Text style={ob.inputLabel}>{pmsConfig.fieldId}</Text><View style={ob.inputRow}><User size={18} color={colors.text.disabled} /><TextInput value={accountId} onChangeText={setAccountId} placeholder={`Enter your ${pmsConfig.fieldId}`} placeholderTextColor={colors.text.disabled} style={ob.input} autoCapitalize="none" autoCorrect={false} keyboardType="number-pad" /></View></View>
                <View style={ob.inputCard}><Text style={ob.inputLabel}>{pmsConfig.fieldKey}</Text><View style={ob.inputRow}><Key size={18} color={colors.text.disabled} /><TextInput value={apiKey} onChangeText={setApiKey} placeholder={`Enter your ${pmsConfig.name} ${pmsConfig.fieldKey}`} placeholderTextColor={colors.text.disabled} style={ob.input} secureTextEntry autoCapitalize="none" autoCorrect={false} /></View></View>
                {error && <View style={ob.errRow}><AlertCircle size={18} color={colors.danger.DEFAULT} /><Text style={ob.errText}>{error}</Text></View>}
                {statusMessage && <View style={ob.statusRow}><Sparkles size={18} color={colors.primary.DEFAULT} /><Text style={ob.statusText}>{statusMessage}</Text></View>}
                <View style={ob.secRow}><Shield size={18} color={colors.primary.DEFAULT} style={{ marginTop: 2 }} /><Text style={ob.secText}>Your credentials are stored securely on your device and never shared with third parties.</Text></View>
                <Pressable style={ob.helpLink}><Text style={ob.helpText}>Where do I find my API credentials?</Text></Pressable>
                <View style={{ paddingBottom: spacing['6'] }}>
                  <Pressable onPress={handleConnectHostaway} disabled={!hasInput || isValidating || pmsConfig.comingSoon} style={({ pressed }) => [ob.ctaBtn, { backgroundColor: hasInput && !isValidating && !pmsConfig.comingSoon ? colors.accent.DEFAULT : colors.bg.hover, marginBottom: spacing['3'], opacity: pressed ? 0.9 : 1 }]}>
                    <Text style={[ob.ctaText, { color: hasInput ? '#FFF' : colors.text.disabled }]}>{isValidating ? (statusMessage || 'Connecting...') : `Connect ${pmsConfig.name}`}</Text>
                    {!isValidating && <ArrowRight size={20} color={hasInput ? '#FFF' : colors.text.disabled} style={{ marginLeft: spacing['2'] }} />}
                  </Pressable>
                  <Pressable onPress={handleStartDemo} disabled={isValidating} style={({ pressed }) => [ob.demoBtn, { opacity: pressed || isValidating ? 0.7 : 1 }]}>
                    <Sparkles size={18} color={colors.accent.DEFAULT} /><Text style={ob.demoText}>Try Demo Mode</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const ob = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  progressWrap: { paddingHorizontal: spacing['6'], paddingTop: spacing['4'] },
  progressBg: { height: 4, backgroundColor: colors.bg.card, borderRadius: radius.full, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: colors.accent.DEFAULT, borderRadius: radius.full },
  stepWrap: { flex: 1, paddingHorizontal: spacing['6'], paddingTop: spacing['12'] },
  logoWrap: { alignItems: 'center', marginBottom: spacing['8'] },
  logoBox: { width: 80, height: 80, borderRadius: radius.xl, backgroundColor: colors.accent.DEFAULT, alignItems: 'center', justifyContent: 'center', marginBottom: spacing['4'] },
  heroTitle: { fontSize: 30, fontFamily: typography.fontFamily.bold, color: colors.text.primary, textAlign: 'center' },
  heroSub: { color: colors.text.muted, textAlign: 'center', marginTop: spacing['2'], fontSize: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated + '80', borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['3'] },
  featureIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.bg.hover, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 16 },
  featureSub: { color: colors.text.muted, fontSize: 14, marginTop: 2 },
  ctaWrap: { flex: 1, justifyContent: 'flex-end', paddingBottom: spacing['6'] },
  ctaBtn: { backgroundColor: colors.accent.DEFAULT, borderRadius: radius.xl, paddingVertical: spacing['4'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFF', fontFamily: typography.fontFamily.bold, fontSize: 18, marginRight: spacing['2'] },
  keyBox: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.primary.muted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing['4'] },
  stepTitle: { fontSize: 24, fontFamily: typography.fontFamily.bold, color: colors.text.primary, textAlign: 'center' },
  stepSub: { color: colors.text.muted, textAlign: 'center', marginTop: spacing['2'], fontSize: 16, paddingHorizontal: spacing['4'] },
  inputCard: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['3'] },
  inputLabel: { color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'], fontFamily: typography.fontFamily.medium },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.hover, borderRadius: radius.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] },
  input: { flex: 1, color: colors.text.primary, fontSize: 16, marginLeft: spacing['3'] },
  errRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.danger.muted, borderRadius: radius.md, padding: spacing['3'], marginBottom: spacing['4'] },
  errText: { color: colors.danger.light, fontSize: 14, marginLeft: spacing['2'], flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary.muted, borderRadius: radius.md, padding: spacing['3'], marginBottom: spacing['4'] },
  statusText: { color: colors.primary.light, fontSize: 14, marginLeft: spacing['2'], flex: 1 },
  secRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.bg.elevated + '80', borderRadius: radius.md, padding: spacing['3'], marginBottom: spacing['4'] },
  secText: { color: colors.text.muted, fontSize: 14, marginLeft: spacing['2'], flex: 1 },
  helpLink: { alignItems: 'center', marginBottom: spacing['6'] },
  helpText: { color: colors.accent.light, fontSize: 14 },
  demoBtn: { backgroundColor: colors.bg.card, borderRadius: radius.xl, paddingVertical: spacing['4'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  demoText: { color: colors.accent.light, fontFamily: typography.fontFamily.semibold, fontSize: 16, marginLeft: spacing['2'] },
});
