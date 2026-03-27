import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { InboxDashboard } from '@/components/InboxDashboard';
import { useNetworkStatus } from '@/lib/useNetworkStatus';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors } from '@/lib/design-tokens';
import { StatusBar } from 'expo-status-bar';
import { canAccessTabs } from '@/lib/session-gate';

export default function InboxTab() {
  const router = useRouter();

  const isOnboarded = useAppStore((s) => s.settings.isOnboarded);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const founderSession = useAppStore((s) => s.founderSession);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);

  const { isOffline, queueLength, recheckNow } = useNetworkStatus();

  // Handle deep linking from notification tap
  useEffect(() => {
    if (activeConversationId && canAccessTabs({
      hasFounderSession: !!founderSession,
      isOnboarded,
      isDemoMode,
    })) {
      console.log('[InboxTab] Deep linking to conversation:', activeConversationId);
      router.push(`/chat/${activeConversationId}`);
      setActiveConversation(null);
    }
  }, [activeConversationId, founderSession, isDemoMode, isOnboarded, setActiveConversation, router]);

  const handleSelectConversation = useCallback((id: string) => {
    router.push(`/chat/${id}`);
  }, [router]);

  const handleOpenSettings = useCallback(() => {
    router.navigate('/(tabs)/settings');
  }, [router]);

  const handleOpenCalendar = useCallback(() => {
    router.navigate('/(tabs)/calendar');
  }, [router]);

  if (!canAccessTabs({
    hasFounderSession: !!founderSession,
    isOnboarded,
    isDemoMode,
  })) {
    return <View style={styles.container} />;
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
});
