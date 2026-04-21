import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { AuthExplainerScreen } from '@/components/AuthExplainerScreen';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { PasswordlessAuthScreen } from '@/components/PasswordlessAuthScreen';
import { features, isContributorDemoForced } from '@/lib/config';
import { useAppStore } from '@/lib/store';
import type { PasswordlessAuthResponseData } from '@/lib/api-client';
import { colors } from '@/lib/design-tokens';

type OnboardingStep = 'loading' | 'explainer' | 'auth' | 'connect';

export default function OnboardingRoute() {
  const router = useRouter();
  const accountSession = useAppStore((s) => s.accountSession);
  const accountSessionLoading = useAppStore((s) => s.accountSessionLoading);
  const restoreAccountSession = useAppStore((s) => s.restoreAccountSession);
  const setAccountSession = useAppStore((s) => s.setAccountSession);
  const enterDemoMode = useAppStore((s) => s.enterDemoMode);
  const [step, setStep] = React.useState<OnboardingStep>('loading');

  React.useEffect(() => {
    let mounted = true;

    async function resolveStep() {
      if (isContributorDemoForced()) {
        if (mounted) setStep('explainer');
        return;
      }

      if (!features.publicAccountFirstOnboarding) {
        if (mounted) setStep('connect');
        return;
      }

      if (accountSession) {
        if (mounted) setStep('connect');
        return;
      }

      const restored = await restoreAccountSession();
      if (!mounted) return;
      setStep(restored ? 'connect' : 'explainer');
    }

    resolveStep().catch((error) => {
      console.error('[OnboardingRoute] Failed to resolve account session:', error);
      if (mounted) {
        setStep(features.publicAccountFirstOnboarding ? 'explainer' : 'connect');
      }
    });

    return () => {
      mounted = false;
    };
  }, [accountSession, restoreAccountSession]);

  const handleTryDemo = React.useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    enterDemoMode();
    router.replace('/(tabs)');
  }, [enterDemoMode, router]);

  const handleAuthenticated = React.useCallback(
    (session: PasswordlessAuthResponseData) => {
      setAccountSession({
        token: session.token,
        refreshToken: session.refreshToken,
        user: session.user,
      });
      setStep('connect');
    },
    [setAccountSession]
  );

  if (step === 'loading' || accountSessionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  if (step === 'explainer') {
    return (
      <>
        <StatusBar style="dark" />
        <AuthExplainerScreen onContinue={() => setStep('auth')} onTryDemo={handleTryDemo} />
      </>
    );
  }

  if (step === 'auth') {
    return (
      <>
        <StatusBar style="dark" />
        <PasswordlessAuthScreen
          onAuthenticated={handleAuthenticated}
          onBack={() => setStep('explainer')}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <OnboardingScreen onComplete={() => router.replace('/(tabs)')} skipIntro />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.base,
  },
});
