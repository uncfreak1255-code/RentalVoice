import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAppStore } from '@/lib/store';
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
import { colors, typography, spacing } from '@/lib/design-tokens';
import { StatusBar } from 'expo-status-bar';
import { getAppEntryDestination, type RestoreOutcome } from '@/lib/session-gate';

export default function AppEntry() {
  const router = useRouter();
  const isOnboarded = useAppStore((s) => s.settings.isOnboarded);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const setCredentials = useAppStore((s) => s.setCredentials);
  const setOnboarded = useAppStore((s) => s.setOnboarded);

  React.useEffect(() => {
    let mounted = true;

    async function boot(): Promise<void> {
      let restoreResult: RestoreOutcome | null = null;

      try {
        if (!isDemoMode) {
          restoreResult = await restoreConnection();
        }

        const destination = getAppEntryDestination({
          isOnboarded,
          isDemoMode,
          restoreResult,
        });

        if (restoreResult?.connected && restoreResult.accountId && restoreResult.apiKey) {
          setCredentials(restoreResult.accountId, restoreResult.apiKey);
          if (destination.shouldRecoverSession) {
            setOnboarded(true);
          }

          runDataMigration(restoreResult.accountId, restoreResult.apiKey).catch((error) => {
            console.warn('[AppEntry] Background migration error (non-fatal):', error);
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
  }, [isDemoMode, isOnboarded, router, setCredentials, setOnboarded]);

  return (
    <View style={styles.loadingContainer}>
      <StatusBar style="dark" />
      <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      <Text style={styles.loadingText}>Opening Rental Voice...</Text>
    </View>
  );
}

async function runDataMigration(enteredAccountId: string, apiKey: string): Promise<void> {
  const stableId = await resolveStableAccountId(enteredAccountId, apiKey);
  if (!stableId) {
    console.log('[AppEntry] Could not resolve stable ID - skipping migration');
    return;
  }

  if (stableId !== enteredAccountId) {
    console.log(`[AppEntry] Stable ID (${stableId}) differs from entered ID (${enteredAccountId}) - running migration`);
    const result = await migrateAccountData(enteredAccountId, stableId);
    if (result.success) {
      console.log(`[AppEntry] Migration complete: ${result.migrated.length} keys migrated`);
    }
  }

  await migrateLegacyUnscopedData(stableId);

  if (isCommercial) {
    const importAlreadyDone = await isCommercialLearningImportDone(stableId);
    if (importAlreadyDone) return;

    try {
      const status = await getCommercialLearningMigrationVerification();
      if (status.hasSnapshot && status.latestSnapshot?.stableAccountId === stableId) {
        await setCommercialLearningImportDone(stableId);
        console.log('[AppEntry] Commercial learning snapshot already present on backend');
        return;
      }

      const snapshotId = `cutover-${stableId}-${Date.now()}`;
      const importResult = await migrateLocalLearningToCommercial(snapshotId);
      await setCommercialLearningImportDone(stableId);
      console.log(
        `[AppEntry] Commercial learning import complete: ` +
        `${importResult.imported.hostStyleProfiles} style profiles, ` +
        `${importResult.imported.editPatterns} edit patterns`
      );
    } catch (error) {
      console.warn('[AppEntry] Commercial learning import skipped (non-fatal):', error);
    }
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
