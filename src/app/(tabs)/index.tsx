import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { InboxDashboard } from '@/components/InboxDashboard';
import { restoreConnection } from '@/lib/hostaway';
import { useNotifications } from '@/lib/NotificationProvider';
import { useNetworkStatus } from '@/lib/useNetworkStatus';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, typography, spacing } from '@/lib/design-tokens';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

export default function InboxTab() {
  const router = useRouter();
  const [isRestoringConnection, setIsRestoringConnection] = useState(true);
  const [needsReauth, setNeedsReauth] = useState(false);

  const isOnboarded = useAppStore((s) => s.settings.isOnboarded);
  const setCredentials = useAppStore((s) => s.setCredentials);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);
  const resetStore = useAppStore((s) => s.resetStore);

  const { isOffline, queueLength, recheckNow } = useNetworkStatus();

  // Handle deep linking from notification tap
  useEffect(() => {
    if (activeConversationId && isOnboarded && !isRestoringConnection) {
      console.log('[InboxTab] Deep linking to conversation:', activeConversationId);
      router.push(`/chat/${activeConversationId}`);
      setActiveConversation(null);
    }
  }, [activeConversationId, isOnboarded, isRestoringConnection, setActiveConversation, router]);

  // Restore connection from secure storage on app startup
  useEffect(() => {
    async function tryRestoreConnection() {
      if (!isOnboarded || isDemoMode) {
        setIsRestoringConnection(false);
        return;
      }

      console.log('[InboxTab] Attempting to restore Hostaway connection...');
      try {
        const result = await restoreConnection();

        if (result.connected && result.accountId && result.apiKey) {
          setCredentials(result.accountId, result.apiKey);
          console.log('[InboxTab] Connection restored successfully');
        } else if (result.needsReauth) {
          console.log('[InboxTab] Credentials invalid, need re-authentication');
          setNeedsReauth(true);
        }
      } catch (error) {
        console.error('[InboxTab] Failed to restore connection:', error);
      } finally {
        setIsRestoringConnection(false);
        SplashScreen.hideAsync().catch(() => {});
      }
    }

    tryRestoreConnection();
  }, [isOnboarded, isDemoMode, setCredentials]);

  const handleSelectConversation = useCallback((id: string) => {
    router.push(`/chat/${id}`);
  }, [router]);

  const handleOpenSettings = useCallback(() => {
    router.navigate('/(tabs)/settings');
  }, [router]);

  const handleOpenCalendar = useCallback(() => {
    router.navigate('/(tabs)/calendar');
  }, [router]);

  // Show loading while restoring connection
  if (isRestoringConnection) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        <Text style={styles.loadingText}>Connecting...</Text>
      </View>
    );
  }

  // Show onboarding if not completed or re-auth needed
  if (!isOnboarded || needsReauth) {
    return (
      <>
        <StatusBar style="dark" />
        <OnboardingScreen onComplete={() => {
          setNeedsReauth(false);
        }} />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <OfflineBanner isOffline={isOffline} queueLength={queueLength} onRetry={recheckNow} />
      <InboxDashboard
        onSelectConversation={handleSelectConversation}
        onOpenSettings={handleOpenSettings}
        onOpenCalendar={handleOpenCalendar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.text.muted,
    marginTop: spacing['4'],
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
  },
});
