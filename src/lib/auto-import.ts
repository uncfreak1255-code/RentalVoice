/**
 * Auto-import utility — starts a 12-month history import and auto-trains
 * the AI style profile immediately after connecting credentials.
 * 
 * This runs independently of the AI Learning screen.
 */
import { historySyncManager } from './history-sync';
import { aiTrainingService } from './ai-training-service';
import { useAppStore } from './store';
import type { HostawayConversation, HostawayMessage } from './history-sync';

const AUTO_IMPORT_MONTHS = 12;

let isAutoImportRunning = false;
let callbacksRegistered = false;

/**
 * Start auto-importing history after first connect.
 * Safe to call multiple times — will only run once.
 */
export async function startAutoImportAfterConnect(
  accountId: string,
  apiKey: string
): Promise<void> {
  // Prevent duplicate runs
  if (isAutoImportRunning) {
    console.log('[AutoImport] Already running, skipping');
    return;
  }

  console.log(`[AutoImport] Starting ${AUTO_IMPORT_MONTHS}-month history import...`);
  isAutoImportRunning = true;

  // Register callbacks if not already done
  if (!callbacksRegistered) {
    callbacksRegistered = true;

    // Wire up auto-training when data arrives
    historySyncManager.onData((conversations, messagesByConversation) => {
      console.log(`[AutoImport] Data received: ${(conversations as HostawayConversation[]).length} conversations, starting auto-training...`);

      const store = useAppStore.getState();
      const existingProfile = store.hostStyleProfiles['global'];

      aiTrainingService.autoTrainOnFetch(
        conversations as HostawayConversation[],
        messagesByConversation as Record<number, HostawayMessage[]>,
        existingProfile
      ).then((result) => {
        if (result.success) {
          const store = useAppStore.getState();
          store.updateHostStyleProfile('global', result.styleProfile);
          store.updateAILearningProgress({
            totalMessagesAnalyzed: result.stats.totalMessagesAnalyzed,
            patternsIndexed: result.stats.patternsIndexed,
            lastTrainingDate: new Date(),
            lastTrainingResult: {
              hostMessagesAnalyzed: result.stats.hostMessagesAnalyzed,
              patternsIndexed: result.stats.patternsIndexed,
              trainingSampleSize: result.stats.trainingSampleSize,
              trainingDurationMs: result.stats.trainingDurationMs,
            },
          });
          console.log(`[AutoImport] ✅ Auto-training complete: ${result.stats.hostMessagesAnalyzed} messages analyzed, ${result.stats.patternsIndexed} patterns indexed`);
        }
      }).catch((error) => {
        console.error('[AutoImport] Auto-training failed:', error);
      });
    });

    // Track completion
    historySyncManager.onComplete((stats) => {
      console.log(`[AutoImport] ✅ History import complete: ${stats.conversations} conversations, ${stats.messages} messages`);
      isAutoImportRunning = false;

      const store = useAppStore.getState();
      store.updateHistorySyncStatus({
        isSyncing: false,
        syncPhase: 'complete',
        syncProgress: 100,
        lastFullSync: new Date(),
        totalConversationsSynced: stats.conversations,
        totalMessagesSynced: stats.messages,
      });
    });

    // Track errors — clear syncing state so banner doesn't get stuck
    historySyncManager.onError((error) => {
      console.warn('[AutoImport] Sync error:', error.message);
      isAutoImportRunning = false;

      const store = useAppStore.getState();
      store.updateHistorySyncStatus({
        isSyncing: false,
        syncPhase: 'error',
        syncError: error.message,
      });
    });

    // Track progress
    historySyncManager.onProgress((progress) => {
      const store = useAppStore.getState();
      store.updateHistorySyncStatus({
        isSyncing: progress.phase !== 'idle' && progress.phase !== 'complete' && progress.phase !== 'error',
        syncPhase: progress.phase,
        syncProgress: progress.percentage,
        processedConversations: progress.processedConversations,
        processedMessages: progress.processedMessages,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
      });
    });
  }

  // Update store to show sync is starting
  const store = useAppStore.getState();
  store.updateHistorySyncStatus({
    isSyncing: true,
    syncPhase: 'conversations',
    syncProgress: 0,
    syncError: null,
  });

  // Start the sync
  try {
    await historySyncManager.start(accountId, apiKey, {
      dateRangeMonths: AUTO_IMPORT_MONTHS,
      resume: false,
    });
  } catch (error) {
    console.error('[AutoImport] Failed to start sync:', error);
    isAutoImportRunning = false;

    const store = useAppStore.getState();
    store.updateHistorySyncStatus({
      isSyncing: false,
      syncPhase: 'error',
      syncError: error instanceof Error ? error.message : 'Sync failed',
    });
  }
}

/**
 * Check if auto-import is currently running
 */
export function isAutoImportActive(): boolean {
  return isAutoImportRunning;
}

/**
 * Check if the AI needs retraining and trigger it from cached data.
 * This should be called on app startup (e.g. InboxDashboard mount).
 * If the response index has fewer than 10 patterns, it means the
 * initial training failed to properly index guest→host pairs
 * (likely due to the isIncoming type coercion bug).
 * 
 * This re-trains using data already cached in AsyncStorage — no API calls needed.
 */
export async function checkAndRetrainIfNeeded(): Promise<void> {
  try {
    const state = aiTrainingService.getState();
    const index = aiTrainingService.getResponseIndex();

    // Only retrain if:
    // 1. Not currently training
    // 2. Initial training has completed (data was fetched at some point)
    // 3. Index is suspiciously low (< 10 patterns from hundreds of messages)
    if (state.isTraining || state.isAutoTraining) {
      console.log('[AutoRetrain] Training already in progress, skipping');
      return;
    }

    if (!state.hasCompletedInitialTraining) {
      console.log('[AutoRetrain] No initial training completed yet, skipping');
      return;
    }

    if (index.totalPatterns >= 10) {
      console.log(`[AutoRetrain] Index has ${index.totalPatterns} patterns, looks healthy`);
      return;
    }

    console.log(`[AutoRetrain] Index only has ${index.totalPatterns} patterns (expected hundreds). Attempting retrain from cached data...`);

    // Load cached history data from AsyncStorage
    const { historySyncManager } = await import('./history-sync');
    await historySyncManager.loadState();

    const data = historySyncManager.getData();
    if (!data || data.conversations.length === 0) {
      console.log('[AutoRetrain] No cached history data available for retraining');
      return;
    }

    console.log(`[AutoRetrain] Found cached data: ${data.conversations.length} conversations. Starting retrain...`);

    const store = useAppStore.getState();
    const existingProfile = store.hostStyleProfiles['global'];

    const result = await aiTrainingService.autoTrainOnFetch(
      data.conversations,
      data.messages,
      existingProfile
    );

    if (result.success) {
      store.updateHostStyleProfile('global', result.styleProfile);
      store.updateAILearningProgress({
        totalMessagesAnalyzed: result.stats.totalMessagesAnalyzed,
        patternsIndexed: result.stats.patternsIndexed,
        lastTrainingDate: new Date(),
        lastTrainingResult: {
          hostMessagesAnalyzed: result.stats.hostMessagesAnalyzed,
          patternsIndexed: result.stats.patternsIndexed,
          trainingSampleSize: result.stats.trainingSampleSize,
          trainingDurationMs: result.stats.trainingDurationMs,
        },
      });
      console.log(`[AutoRetrain] ✅ Retraining complete: ${result.stats.patternsIndexed} patterns indexed (was ${index.totalPatterns})`);
    }
  } catch (error) {
    console.error('[AutoRetrain] Retraining failed:', error);
  }
}
