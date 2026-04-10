import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, AppState, type AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAppStore } from '@/lib/store';
import { restoreConnection } from '@/lib/hostaway';
import { resolveStableAccountId } from '@/lib/stable-account-id';
import { migrateAccountData, migrateLegacyUnscopedData } from '@/lib/account-data-migration';
import { isCommercial } from '@/lib/config';
import {
  ensureCommercialLearningMigrationForAccount,
} from '@/lib/commercial-migration';
import { canSync, isLocalLearningEmpty, restoreLearningFromCloud, syncLearningToCloud, getSyncStatus } from '@/lib/learning-sync';
import { colors, typography, spacing } from '@/lib/design-tokens';
import { StatusBar } from 'expo-status-bar';
import { getAppEntryDestination, type RestoreOutcome } from '@/lib/session-gate';

export default function AppEntry() {
  const router = useRouter();
  const isOnboarded = useAppStore((s) => s.settings.isOnboarded);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const accountSession = useAppStore((s) => s.accountSession);
  const restoreAccountSession = useAppStore((s) => s.restoreAccountSession);
  const setCredentials = useAppStore((s) => s.setCredentials);
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const restoreFounderSession = useAppStore((s) => s.restoreFounderSession);

  React.useEffect(() => {
    let mounted = true;

    async function boot(): Promise<void> {
      let restoreResult: RestoreOutcome | null = null;
      let restoredAccountSession = accountSession;
      let hasFounderSession = false;

      try {
        let hostawayMigrationPromise: Promise<string | undefined> = Promise.resolve(undefined);

        if (!isDemoMode) {
          const founderSession = await restoreFounderSession();
          hasFounderSession = !!founderSession;
        }

        if (!isDemoMode && !hasFounderSession && !restoredAccountSession) {
          restoredAccountSession = await restoreAccountSession();
        }

        if (!isDemoMode && !hasFounderSession) {
          restoreResult = await restoreConnection();
        }

        const destination = getAppEntryDestination({
          hasFounderSession,
          isOnboarded,
          isDemoMode,
          restoreResult,
          hasAccountSession: Boolean(restoredAccountSession),
        });

        if (hasFounderSession) {
          restoreLearningIfNeeded().catch((error) => {
            console.warn('[AppEntry] Founder learning restore error (non-fatal):', error);
          });
        } else if (restoreResult?.connected && restoreResult.accountId && restoreResult.apiKey) {
          setCredentials(restoreResult.accountId, restoreResult.apiKey);
          if (destination.shouldRecoverSession) {
            setOnboarded(true);
          }

          hostawayMigrationPromise = runDataMigration(restoreResult.accountId, restoreResult.apiKey);
          hostawayMigrationPromise.catch((error) => {
            console.warn('[AppEntry] Background migration error (non-fatal):', error);
          });

          // Restore learning from cloud if local state is empty (fresh install/reset)
          restoreLearningIfNeeded().catch((error) => {
            console.warn('[AppEntry] Learning restore error (non-fatal):', error);
          });
        }

        if (!isDemoMode && isCommercial && restoredAccountSession) {
          hostawayMigrationPromise
            .then((stableAccountId) =>
              ensureCommercialLearningMigrationForAccount(restoredAccountSession as NonNullable<typeof restoredAccountSession>, {
                stableAccountId,
              })
            )
            .then((result) => {
              if (result.status === 'imported') {
                console.log('[AppEntry] Commercial learning import bound to authenticated account');
              }
            })
            .catch((error) => {
              console.warn('[AppEntry] Commercial learning import skipped (non-fatal):', error);
            });
        }

        if (!mounted) return;
        router.replace(destination.route as any);
      } catch (error) {
        console.error('[AppEntry] Failed to resolve app entry:', error);
        if (mounted) {
          router.replace('/onboarding');
        }
      } finally {
        SplashScreen.hideAsync().catch(() => {});
      }
    }

    boot();

    return () => {
      mounted = false;
    };
  }, [
    accountSession,
    isDemoMode,
    isOnboarded,
    restoreAccountSession,
    restoreFounderSession,
    router,
    setCredentials,
    setOnboarded,
  ]);

  // Sync learning data when app returns to foreground
  React.useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;

      const session = await canSync();
      if (!session) return;

      const status = await getSyncStatus();
      const fiveMinutes = 5 * 60 * 1000;
      if (status.lastSyncedAt && Date.now() - new Date(status.lastSyncedAt).getTime() < fiveMinutes) return;

      syncLearningToCloud().catch(err =>
        console.warn('[AppEntry] Foreground sync failed (non-critical):', err)
      );
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.loadingContainer}>
      <StatusBar style="dark" />
      <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      <Text style={styles.loadingText}>Opening Rental Voice...</Text>
    </View>
  );
}

async function runDataMigration(enteredAccountId: string, apiKey: string): Promise<string | undefined> {
  const stableId = await resolveStableAccountId(enteredAccountId, apiKey);
  if (!stableId) {
    console.log('[AppEntry] Could not resolve stable ID - skipping migration');
    return undefined;
  }

  if (stableId !== enteredAccountId) {
    console.log(`[AppEntry] Stable ID (${stableId}) differs from entered ID (${enteredAccountId}) - running migration`);
    const result = await migrateAccountData(enteredAccountId, stableId);
    if (result.success) {
      console.log(`[AppEntry] Migration complete: ${result.migrated.length} keys migrated`);
    }
  }

  await migrateLegacyUnscopedData(stableId);

  return stableId;
}

async function restoreLearningIfNeeded(): Promise<void> {
  const session = await canSync();
  if (!session) return; // No founder auth — nothing to restore from

  const empty = await isLocalLearningEmpty();
  if (!empty) return; // Local learning exists — no need to pull

  console.log('[AppEntry] Local learning empty, restoring from cloud...');
  const result = await restoreLearningFromCloud();
  if (result.success && result.profileRestored) {
    console.log(`[AppEntry] Learning restored: profile + ${result.examplesRestored} examples`);
  } else if (!result.success) {
    console.warn('[AppEntry] Learning restore failed:', result.error);
  }
}

const styles = StyleSheet.create({
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
