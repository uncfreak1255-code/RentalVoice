import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Key,
  MessageSquare,
  Shield,
  Sparkles,
  User,
  Zap,
} from 'lucide-react-native';
import { AccuracyChart } from '@/components/ui/AccuracyChart';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/lib/store';
import { initializeConnection, validateCredentials } from '@/lib/hostaway';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import { startAutoImportAfterConnect } from '@/lib/auto-import';
import { features as appFeatures } from '@/lib/config';
import {
  connectHostaway as connectHostawayServer,
  getHostawayHistorySyncStatusViaServer,
  type HostawayHistorySyncJob,
} from '@/lib/api-client';
import { VoiceLearningBanner } from './VoiceLearningBanner';

interface OnboardingScreenProps {
  onComplete: () => void;
  skipIntro?: boolean;
  managedModeOverride?: boolean;
}

const FEATURE_CARDS = [
  {
    icon: MessageSquare,
    title: 'Unified Inbox',
    desc: 'Handle guest replies from one focused inbox.',
  },
  {
    icon: Sparkles,
    title: 'AI That Learns Your Style',
    desc: 'Training improves after sync instead of blocking setup.',
  },
  {
    icon: Zap,
    title: 'Background Sync',
    desc: 'Recent conversations and learning history import after entry.',
  },
];

const HELP_STEPS = [
  '1. Log in to your Hostaway dashboard.',
  '2. Open Settings > API.',
  '3. Copy your Account ID and API Secret Key.',
  '4. Paste both values here to connect Rental Voice.',
];

export function OnboardingScreen({
  onComplete,
  skipIntro = false,
  managedModeOverride,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(skipIntro ? 1 : 0);
  const [accountId, setAccountId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showCredentialHelp, setShowCredentialHelp] = useState(false);
  const [managedHistorySyncJob, setManagedHistorySyncJob] = useState<HostawayHistorySyncJob | null>(null);
  const progress = useSharedValue(0.5);

  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const setDemoMode = useAppStore((s) => s.setDemoMode);
  const enterDemoMode = useAppStore((s) => s.enterDemoMode);
  const setCredentials = useAppStore((s) => s.setCredentials);
  const setConversations = useAppStore((s) => s.setConversations);
  const setProperties = useAppStore((s) => s.setProperties);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setVoiceReadiness = useAppStore((s) => s.setVoiceReadiness);

  useEffect(() => {
    progress.value = withSpring(skipIntro ? 1 : (step + 1) / 2, { damping: 15 });
  }, [progress, skipIntro, step]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const footerPadding = useMemo(
    () => Math.max(insets.bottom, spacing['4']),
    [insets.bottom]
  );

  const hasInput = accountId.trim().length > 0 && apiKey.trim().length > 0;
  const isConnectDisabled = !hasInput || isValidating;
  const isServerManaged = managedModeOverride ?? (appFeatures?.serverProxiedAI === true);
  const showingManagedLearning = isServerManaged && managedHistorySyncJob !== null;

  useEffect(() => {
    if (!showingManagedLearning || !managedHistorySyncJob) {
      return;
    }

    const updateVoiceReadiness = (job: HostawayHistorySyncJob) => {
      const status =
        job.status === 'completed' || job.phase === 'complete'
          ? 'ready'
          : job.status === 'failed' || job.status === 'cancelled' || job.phase === 'error'
            ? 'degraded'
            : 'learning';

      const reason =
        status === 'ready'
          ? 'Voice grounding is ready on the server.'
          : status === 'degraded'
            ? job.lastError || 'History sync needs attention.'
            : 'Importing Hostaway history and learning your voice.';

      setVoiceReadiness({
        state: status,
        reason,
        updatedAt: new Date().toISOString(),
        autopilotEligible: status === 'ready',
        importedExamples: 0,
        styleSamples: 0,
        semanticReady: status !== 'degraded',
      });
    };

    let cancelled = false;
    updateVoiceReadiness(managedHistorySyncJob);

    if (
      managedHistorySyncJob.status === 'completed' ||
      managedHistorySyncJob.status === 'failed' ||
      managedHistorySyncJob.status === 'cancelled' ||
      managedHistorySyncJob.phase === 'complete' ||
      managedHistorySyncJob.phase === 'error'
    ) {
      return;
    }

    const poll = async () => {
      try {
        const latestJob = await getHostawayHistorySyncStatusViaServer();
        if (!latestJob || cancelled) return;
        setManagedHistorySyncJob(latestJob);
        updateVoiceReadiness(latestJob);
      } catch (pollError) {
        console.warn('[Onboarding] Failed to poll Hostaway history sync status:', pollError);
      }
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [managedHistorySyncJob, setVoiceReadiness, showingManagedLearning]);

  const handleManagedContinue = () => {
    setOnboarded(true);
    onComplete();
  };

  const handleStartDemo = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    enterDemoMode();
    onComplete();
  };

  const handleConnectHostaway = async () => {
    if (isConnectDisabled) return;

    setIsValidating(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (isServerManaged) {
        const connection = await connectHostawayServer(accountId.trim(), apiKey.trim());
        setCredentials('', '');
        setDemoMode(false);
        updateSettings({ pmsProvider: 'hostaway' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (connection.historySyncJob) {
          setManagedHistorySyncJob(connection.historySyncJob);
          return;
        }

        setOnboarded(true);
        onComplete();
        return;
      } else {
        const isValid = await validateCredentials(accountId.trim(), apiKey.trim());
        if (!isValid) {
          setError('Invalid credentials. Please check your Account ID and API Secret Key.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsValidating(false);
          return;
        }

        const initialized = await initializeConnection(accountId.trim(), apiKey.trim());
        if (!initialized) {
          throw new Error('Failed to initialize Hostaway connection');
        }

        setCredentials(accountId.trim(), apiKey.trim());
      }

      setDemoMode(false);
      setOnboarded(true);
      updateSettings({ pmsProvider: 'hostaway' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();

      if (!isServerManaged) {
        startAutoImportAfterConnect(accountId.trim(), apiKey.trim()).catch((syncError) => {
          console.warn('[Onboarding] Background sync failed to start:', syncError);
        });
      }
    } catch (err) {
      console.error('[Onboarding]', err);
      setError('Failed to connect to Hostaway. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <View style={ob.root}>
      <LinearGradient
        colors={[colors.bg.subtle, colors.bg.elevated, colors.bg.subtle]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={ob.safeArea} edges={['top', 'bottom']}>
        <View style={ob.progressWrap}>
          <View style={ob.progressBg}>
            <Animated.View style={[ob.progressBar, progressStyle]} />
          </View>
        </View>

        {!skipIntro && step === 0 ? (
          <Animated.View entering={FadeIn.duration(500)} style={ob.stepWrap}>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
              <Animated.View entering={FadeInDown.delay(150).duration(500)} style={ob.logoWrap}>
                <View style={ob.logoBox}>
                  <MessageSquare size={40} color={colors.text.inverse} />
                </View>
                <Text style={ob.heroTitle}>Rental Voice</Text>
                <Text style={ob.heroSub}>Smart guest communication for vacation rentals</Text>
              </Animated.View>

              <View style={ob.featureList}>
                {FEATURE_CARDS.map((feature, index) => (
                  <Animated.View
                    key={feature.title}
                    entering={FadeInDown.delay(250 + index * 120).duration(450)}
                    style={ob.featureRow}
                  >
                    <View style={ob.featureIcon}>
                      <feature.icon size={24} color={colors.accent.DEFAULT} />
                    </View>
                    <View style={ob.featureCopy}>
                      <Text style={ob.featureTitle}>{feature.title}</Text>
                      <Text style={ob.featureSub}>{feature.desc}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>

              {/* Accuracy trajectory card — honesty beat from the Claude Design refresh */}
              <Animated.View
                entering={FadeInDown.delay(250 + FEATURE_CARDS.length * 120).duration(450)}
                style={ob.accuracyCard}
              >
                <Text style={ob.accuracyEyebrow}>HOW GOOD IT GETS</Text>
                <AccuracyChart />
                <Text style={ob.accuracyCopy}>
                  New AIs start around 40%. After two weeks of real messages and a few edits, most
                  hosts reach 85%+. You stay in control until it earns trust.
                </Text>
              </Animated.View>

              <View style={ob.heroFooter}>
                <Animated.View entering={FadeInUp.delay(700).duration(400)}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setStep(1);
                    }}
                    style={({ pressed }) => [ob.primaryButton, pressed && ob.pressed]}
                    testID="onboarding-get-started"
                  >
                    <Text style={ob.primaryButtonText}>Get Started</Text>
                    <ArrowRight size={20} color={colors.text.inverse} />
                  </Pressable>
                </Animated.View>
              </View>
            </ScrollView>
          </Animated.View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            style={ob.safeArea}
          >
            <View style={ob.formShell}>
              <ScrollView
                style={ob.formScroll}
                contentContainerStyle={[ob.formContent, { paddingBottom: spacing['6'] }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Animated.View entering={SlideInRight.duration(350)}>
                  <View style={ob.logoWrap}>
                    <View style={ob.keyBox}>
                      <Key size={32} color={colors.primary.DEFAULT} />
                    </View>
                    <Text style={ob.stepTitle}>
                      {showingManagedLearning ? 'Learning In Progress' : 'Connect Hostaway'}
                    </Text>
                    <Text style={ob.stepSub}>
                      {showingManagedLearning
                        ? 'Your account is connected. We are syncing past conversations so server drafts can learn your voice without blocking entry.'
                        : 'Enter your Hostaway Account ID and API Secret Key. We will connect first and sync the rest in the background.'}
                    </Text>
                  </View>

                  {showingManagedLearning ? (
                    <>
                      <VoiceLearningBanner job={managedHistorySyncJob} />
                      <View style={ob.infoCard}>
                        <CheckCircle2 size={18} color={colors.primary.DEFAULT} style={ob.infoIcon} />
                        <View style={ob.infoCopy}>
                          <Text style={ob.infoTitle}>What happens next</Text>
                          <Text style={ob.infoText}>Drafts are available now while the server keeps learning from past replies.</Text>
                          <Text style={ob.infoText}>Autopilot stays off until your voice model reaches the readiness gate.</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={ob.providerBadge}>
                        <Text style={ob.providerBadgeText}>Hostaway</Text>
                        <Text style={ob.providerBadgeSub}>Current supported PMS</Text>
                      </View>

                      <View style={ob.inputCard}>
                        <Text style={ob.inputLabel}>Account ID</Text>
                        <View style={ob.inputRow}>
                          <User size={18} color={colors.text.disabled} />
                          <TextInput
                            value={accountId}
                            onChangeText={(value) => setAccountId(value.replace(/\D/g, ''))}
                            placeholder="Enter your Account ID"
                            placeholderTextColor={colors.text.disabled}
                            style={ob.input}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="number-pad"
                            returnKeyType="next"
                            testID="onboarding-account-id"
                          />
                        </View>
                      </View>

                      <View style={ob.inputCard}>
                        <Text style={ob.inputLabel}>API Secret Key</Text>
                        <View style={ob.inputRow}>
                          <Key size={18} color={colors.text.disabled} />
                          <TextInput
                            value={apiKey}
                            onChangeText={setApiKey}
                            placeholder="Enter your Hostaway API Secret Key"
                            placeholderTextColor={colors.text.disabled}
                            style={ob.input}
                            secureTextEntry={!showApiKey}
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="done"
                            testID="onboarding-api-key"
                          />
                          <Pressable
                            onPress={() => setShowApiKey((current) => !current)}
                            hitSlop={10}
                            style={ob.eyeToggle}
                            testID="onboarding-eye-toggle"
                          >
                            <Text style={ob.eyeToggleText}>{showApiKey ? 'Hide' : 'Show'}</Text>
                          </Pressable>
                        </View>
                      </View>

                      {error ? (
                        <View style={ob.errorRow}>
                          <AlertCircle size={18} color={colors.danger.DEFAULT} />
                          <Text style={ob.errorText}>{error}</Text>
                        </View>
                      ) : null}

                      <View style={ob.infoCard}>
                        <CheckCircle2 size={18} color={colors.primary.DEFAULT} style={ob.infoIcon} />
                        <View style={ob.infoCopy}>
                          <Text style={ob.infoTitle}>What happens next</Text>
                          <Text style={ob.infoText}>You enter the app immediately after connection.</Text>
                          <Text style={ob.infoText}>Recent conversations and AI training sync in the background.</Text>
                          <Text style={ob.infoText}>Detailed progress stays available from Sync Data and AI Learning.</Text>
                        </View>
                      </View>

                      <View style={ob.securityRow}>
                        <Shield size={18} color={colors.primary.DEFAULT} style={ob.infoIcon} />
                        <Text style={ob.securityText}>
                          {isServerManaged
                            ? 'Your Hostaway connection is validated server-side so message history can train your account-backed voice model.'
                            : 'Your Hostaway credentials are stored securely on your device in personal mode.'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => setShowCredentialHelp((current) => !current)}
                        style={ob.helpLink}
                      >
                        <Text style={ob.helpText}>Where do I find my API credentials?</Text>
                        <ChevronRight size={16} color={colors.accent.DEFAULT} />
                      </Pressable>

                      {showCredentialHelp ? (
                        <View style={ob.helpCard}>
                          <Text style={ob.helpCardTitle}>Find your Hostaway API credentials</Text>
                          {HELP_STEPS.map((stepText) => (
                            <Text key={stepText} style={ob.helpCardText}>
                              {stepText}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </>
                  )}
                </Animated.View>
              </ScrollView>

              <View style={[ob.footer, { paddingBottom: footerPadding }]}> 
                {showingManagedLearning ? (
                  <Pressable
                    onPress={handleManagedContinue}
                    accessibilityLabel="Continue to inbox"
                    style={({ pressed }) => [ob.primaryButton, ob.footerButton, pressed && ob.pressed]}
                    testID="onboarding-managed-continue"
                  >
                    <Text style={ob.primaryButtonText}>Continue to Inbox</Text>
                    <ArrowRight size={20} color="#FFFFFF" />
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      onPress={handleConnectHostaway}
                      accessibilityLabel="Connect Hostaway"
                      disabled={isConnectDisabled}
                      style={({ pressed }) => [
                        ob.primaryButton,
                        ob.footerButton,
                        isConnectDisabled ? ob.primaryButtonDisabled : null,
                        pressed && !isConnectDisabled ? ob.pressed : null,
                      ]}
                      testID="onboarding-connect"
                    >
                      <Text style={[ob.primaryButtonText, isConnectDisabled ? ob.primaryButtonTextDisabled : null]}>
                        {isValidating ? 'Connecting Hostaway...' : 'Connect Hostaway'}
                      </Text>
                      {!isValidating ? (
                        <ArrowRight size={20} color={isConnectDisabled ? colors.text.muted : '#FFFFFF'} />
                      ) : null}
                    </Pressable>

                    <Pressable
                      onPress={handleStartDemo}
                      disabled={isValidating}
                      style={({ pressed }) => [ob.secondaryButton, (pressed || isValidating) && ob.secondaryPressed]}
                      testID="onboarding-demo-mode"
                    >
                      <Sparkles size={18} color={colors.accent.DEFAULT} />
                      <Text style={ob.secondaryButtonText}>Try Demo Mode</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const ob = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  safeArea: {
    flex: 1,
  },
  progressWrap: {
    paddingHorizontal: spacing['6'],
    paddingTop: spacing['4'],
  },
  progressBg: {
    height: 4,
    backgroundColor: colors.bg.card,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radius.full,
  },
  stepWrap: {
    flex: 1,
    paddingHorizontal: spacing['6'],
    paddingTop: spacing['6'],
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing['8'],
  },
  logoBox: {
    width: 84,
    height: 84,
    borderRadius: radius.xl,
    backgroundColor: colors.accent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['4'],
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  heroSub: {
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing['2'],
    fontSize: 16,
  },
  featureList: {
    marginTop: spacing['2'],
    gap: spacing['3'],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.bg.elevated}CC`,
    borderRadius: radius.xl,
    padding: spacing['4'],
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.bg.hover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: {
    flex: 1,
    marginLeft: spacing['4'],
  },
  featureTitle: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 16,
  },
  featureSub: {
    color: colors.text.muted,
    fontSize: 14,
    marginTop: 2,
  },
  heroFooter: {
    paddingTop: spacing['8'],
    paddingBottom: spacing['8'],
  },
  accuracyCard: {
    marginTop: spacing['4'],
    padding: spacing['4'],
    borderRadius: radius.xl,
    backgroundColor: colors.success.soft,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  accuracyEyebrow: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.success.DEFAULT,
    letterSpacing: 0.8,
    marginBottom: spacing['2'],
  },
  accuracyCopy: {
    fontSize: 13,
    color: colors.text.muted,
    lineHeight: 19,
    marginTop: spacing['2'],
  },
  formShell: {
    flex: 1,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: spacing['6'],
    paddingTop: spacing['8'],
  },
  keyBox: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['4'],
  },
  stepTitle: {
    fontSize: 28,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  stepSub: {
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing['2'],
    fontSize: 16,
    paddingHorizontal: spacing['4'],
  },
  providerBadge: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing['4'],
    marginBottom: spacing['4'],
  },
  providerBadgeText: {
    color: colors.primary.DEFAULT,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 16,
  },
  providerBadgeSub: {
    color: colors.text.muted,
    fontSize: 13,
    marginTop: 4,
  },
  inputCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing['4'],
    marginBottom: spacing['3'],
  },
  inputLabel: {
    color: colors.text.muted,
    fontSize: 14,
    marginBottom: spacing['2'],
    fontFamily: typography.fontFamily.medium,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.hover,
    borderRadius: radius.md,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    minHeight: 56,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 16,
    marginLeft: spacing['3'],
  },
  eyeToggle: {
    paddingVertical: 6,
    paddingLeft: spacing['3'],
  },
  eyeToggleText: {
    color: colors.text.muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger.muted,
    borderRadius: radius.md,
    padding: spacing['3'],
    marginBottom: spacing['4'],
  },
  errorText: {
    color: colors.danger.DEFAULT,
    fontSize: 14,
    marginLeft: spacing['2'],
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing['4'],
    marginBottom: spacing['3'],
  },
  infoIcon: {
    marginTop: 2,
  },
  infoCopy: {
    flex: 1,
    marginLeft: spacing['3'],
  },
  infoTitle: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 15,
    marginBottom: 6,
  },
  infoText: {
    color: colors.text.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.bg.elevated}CC`,
    borderRadius: radius.lg,
    padding: spacing['3'],
    marginBottom: spacing['3'],
  },
  securityText: {
    color: colors.text.muted,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: spacing['3'],
    flex: 1,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing['3'],
  },
  helpText: {
    color: colors.accent.DEFAULT,
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
  },
  helpCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing['4'],
    marginBottom: spacing['4'],
  },
  helpCardTitle: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 15,
    marginBottom: spacing['2'],
  },
  helpCardText: {
    color: colors.text.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    paddingHorizontal: spacing['6'],
    paddingTop: spacing['3'],
    backgroundColor: `${colors.bg.base}F2`,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: spacing['3'],
  },
  primaryButton: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radius.xl,
    paddingVertical: spacing['4'],
    paddingHorizontal: spacing['4'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButton: {
    minHeight: 58,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.bold,
    fontSize: 17,
    marginRight: spacing['2'],
  },
  primaryButtonTextDisabled: {
    color: colors.text.muted,
  },
  secondaryButton: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    paddingVertical: spacing['4'],
    paddingHorizontal: spacing['4'],
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.accent.DEFAULT,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 16,
    marginLeft: spacing['2'],
  },
  secondaryPressed: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.9,
  },
});
