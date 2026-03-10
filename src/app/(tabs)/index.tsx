import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { InboxDashboard } from '@/components/InboxDashboard';
import { restoreConnection } from '@/lib/hostaway';
import { resolveStableAccountId } from '@/lib/stable-account-id';
import { migrateAccountData, migrateLegacyUnscopedData } from '@/lib/account-data-migration';
import { isCommercial } from '@/lib/config';
import {
  getCommercialLearningMigrationVerification,
  migrateLocalLearningToCommercial,
} from '@/lib/commercial-migration';
import {
  isCommercialLearningImportDone,
  setCommercialLearningImportDone,
} from '@/lib/secure-storage';
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
  const restoreFounderSession = useAppStore((s) => s.restoreFounderSession);
  const founderSession = useAppStore((s) => s.founderSession);

  const { isOffline, queueLength, recheckNow } = useNetworkStatus();

  // Handle deep linking from notification tap
  useEffect(() => {
    if (activeConversationId && isOnboarded && !isRestoringConnection) {
      console.log('[InboxTab] Deep linking to conversation:', activeConversationId);
      router.push(`/chat/${activeConversationId}`);
      setActiveConversation(null);
    }
  }, [activeConversationId, isOnboarded, isRestoringConnection, setActiveConversation, router]);

  // Attempt to restore founder session from secure storage on app startup.
  // This runs before Hostaway restore — founder session takes priority.
  useEffect(() => {
    restoreFounderSession().catch((err) => {
      console.error('[InboxTab] Founder session restore failed (non-fatal):', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

          // Run data migration in the background (non-blocking).
          // resolveStableAccountId will use the cached value from restoreConnection
          // if it's already been fetched, or fetch it now if not.
          runDataMigration(result.accountId, result.apiKey).catch((err) => {
            console.warn('[InboxTab] Background migration error (non-fatal):', err);
          });
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

  /**
   * Resolve the stable account ID and migrate data if needed.
   * Runs in the background — never blocks the UI.
   */
  async function runDataMigration(enteredAccountId: string, apiKey: string): Promise<void> {
    const stableId = await resolveStableAccountId(enteredAccountId, apiKey);
    if (!stableId) {
      console.log('[InboxTab] Could not resolve stable ID — skipping migration');
      return;
    }

    // Migrate from old prefix (entered accountId / API key ID) to stable ID
    if (stableId !== enteredAccountId) {
      console.log(`[InboxTab] Stable ID (${stableId}) differs from entered ID (${enteredAccountId}) — running migration`);
      const result = await migrateAccountData(enteredAccountId, stableId);
      if (result.success) {
        console.log(`[InboxTab] Migration complete: ${result.migrated.length} keys migrated`);
      }
    }

    // Also pick up any legacy unscoped data
    await migrateLegacyUnscopedData(stableId);

    // Commercial mode: one-time import of local learning/profile snapshot to backend.
    if (isCommercial) {
      const importAlreadyDone = await isCommercialLearningImportDone(stableId);
      if (importAlreadyDone) return;

      try {
        const status = await getCommercialLearningMigrationVerification();
        if (status.hasSnapshot && status.latestSnapshot?.stableAccountId === stableId) {
          await setCommercialLearningImportDone(stableId);
          console.log('[InboxTab] Commercial learning snapshot already present on backend');
          return;
        }

        const snapshotId = `cutover-${stableId}-${Date.now()}`;
        const importResult = await migrateLocalLearningToCommercial(snapshotId);
        await setCommercialLearningImportDone(stableId);
        console.log(
          `[InboxTab] Commercial learning import complete: ` +
          `${importResult.imported.hostStyleProfiles} style profiles, ` +
          `${importResult.imported.editPatterns} edit patterns`
        );
      } catch (error) {
        console.warn('[InboxTab] Commercial learning import skipped (non-fatal):', error);
      }
    }
  }

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
