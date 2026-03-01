import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Modal, TextInput, AppState, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft,
  Brain,
  TrendingUp,
  CheckCircle,
  Edit3,
  RefreshCw,
  Sparkles,
  BarChart3,
  Trash2,
  Download,
  Calendar,
  Clock,
  AlertCircle,
  X,
  Database,
  Pause,
  Play,
  Square,
  Moon,
  Zap,
  Sliders,
  Smartphone,
  CloudOff,
  MessageSquare,
  FileText,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { analyzeConversationsForStyle, calculateLearningProgress } from '@/lib/ai-learning';
import { historySyncManager, formatTimeRemaining, type SyncProgress, type HostawayConversation, type HostawayMessage } from '@/lib/history-sync';
import {
  backgroundSyncManager,
  isBackgroundFetchAvailable,
  formatBackgroundSyncStatus,
  type BackgroundSyncProgress,
  type BackgroundSyncState,
} from '@/lib/background-fetch-service';
import {
  aiTrainingService,
  formatTrainingStatus,
  getTrainingSummary,
  type TrainingState,
  type TrainingResult,
} from '@/lib/ai-training-service';
import {
  computeCalibrationSummary,
  generateVoiceDNA,
} from '@/lib/ai-intelligence';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import { SectionHeader, SectionFooter, Row, ValueRow, LinkRow, s } from './ui/SettingsComponents';

interface AILearningScreenProps {
  onBack: () => void;
}

export function AILearningScreen({ onBack }: AILearningScreenProps) {
  const learningEntries = useAppStore((s) => s.learningEntries);
  const conversations = useAppStore((s) => s.conversations);
  const properties = useAppStore((s) => s.properties);
  const hostStyleProfiles = useAppStore((s) => s.hostStyleProfiles);
  const aiLearningProgress = useAppStore((s) => s.aiLearningProgress);
  const updateHostStyleProfile = useAppStore((s) => s.updateHostStyleProfile);
  const updateAILearningProgress = useAppStore((s) => s.updateAILearningProgress);
  const resetAILearning = useAppStore((s) => s.resetAILearning);
  const draftOutcomes = useAppStore((s) => s.draftOutcomes);
  const calibrationEntries = useAppStore((s) => s.calibrationEntries);
  const conversationFlows = useAppStore((s) => s.conversationFlows);
  const replyDeltas = useAppStore((s) => s.replyDeltas);

  // Tier 3: Memoized computed values (avoid recomputing on every render)
  const calSummary = useMemo(
    () => calibrationEntries.length >= 3 ? computeCalibrationSummary(calibrationEntries) : null,
    [calibrationEntries]
  );
  const deltaStats = useMemo(() => {
    if (replyDeltas.length < 3) return null;
    return {
      hostMoreSpecific: replyDeltas.filter(d => d.specificityDelta === 'host_more_specific').length,
      totalAdded: replyDeltas.reduce((sum, d) => sum + d.contentAdded.length, 0),
      totalRemoved: replyDeltas.reduce((sum, d) => sum + d.contentRemoved.length, 0),
      recentDeltas: replyDeltas.slice(0, 5),
    };
  }, [replyDeltas]);

  // History sync state
  const historySyncStatus = useAppStore((s) => s.historySyncStatus);
  const updateHistorySyncStatus = useAppStore((s) => s.updateHistorySyncStatus);
  const setHistoryDateRange = useAppStore((s) => s.setHistoryDateRange);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);

  const [isTraining, setIsTraining] = useState(false);
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [dateRangeMonths, setDateRangeMonths] = useState<string>('24');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);


  // Background sync state
  const [backgroundSyncState, setBackgroundSyncState] = useState<BackgroundSyncState | null>(null);
  const [backgroundSyncProgress, setBackgroundSyncProgress] = useState<BackgroundSyncProgress | null>(null);
  const [backgroundFetchAvailable, setBackgroundFetchAvailable] = useState<boolean | null>(null);
  const [backgroundFetchStatusText, setBackgroundFetchStatusText] = useState<string>('');

  // AI Training state
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const [showTrainingComplete, setShowTrainingComplete] = useState(false);
  const [lastTrainingResult, setLastTrainingResult] = useState<TrainingResult | null>(null);

  // Store reference to fetched data for manual training
  const [fetchedHistoryData, setFetchedHistoryData] = useState<{
    conversations: HostawayConversation[];
    messages: Record<number, HostawayMessage[]>;
  } | null>(null);

  // Animated rotation for loading spinner
  const spinValue = useSharedValue(0);

  useEffect(() => {
    if (historySyncStatus.isSyncing) {
      spinValue.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      spinValue.value = 0;
    }
  }, [historySyncStatus.isSyncing, spinValue]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value}deg` }],
  }));

  // Initialize sync manager and set up callbacks
  useEffect(() => {
    historySyncManager.loadState().then(() => {
      const state = historySyncManager.getState();
      if (state.phase !== 'idle' && state.phase !== 'complete') {
        updateHistorySyncStatus({
          canResume: historySyncManager.canResume(),
          syncPhase: state.phase,
          processedConversations: state.processedConversations,
          processedMessages: state.processedMessages,
        });
      }

      // Recover fetched data from sync manager if available (survives screen remounts)
      const cachedData = historySyncManager.getData();
      if (cachedData && !fetchedHistoryData) {
        setFetchedHistoryData(cachedData);
        console.log(`[AI Learning] Recovered ${cachedData.conversations.length} conversations from sync manager cache`);
      }
    });

    // Set up progress callback
    historySyncManager.onProgress((progress) => {
      setSyncProgress(progress);
      updateHistorySyncStatus({
        isSyncing: progress.phase !== 'idle' && progress.phase !== 'complete' && progress.phase !== 'error',
        isPaused: historySyncManager.getState().isPaused,
        syncPhase: progress.phase,
        syncProgress: progress.percentage,
        processedConversations: progress.processedConversations,
        processedMessages: progress.processedMessages,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        currentBatch: progress.currentBatch,
        totalBatches: progress.totalBatches,
        errorCount: progress.errorCount,
        canResume: historySyncManager.canResume(),
      });
    });

    // Set up error callback
    historySyncManager.onError((error) => {
      updateHistorySyncStatus({
        syncError: error.message,
        errorLog: [...historySyncStatus.errorLog, error],
      });
    });

    // Set up completion callback
    historySyncManager.onComplete((stats) => {
      updateHistorySyncStatus({
        isSyncing: false,
        syncPhase: 'complete',
        syncProgress: 100,
        lastFullSync: new Date(),
        totalConversationsSynced: stats.conversations,
        totalMessagesSynced: stats.messages,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    // Set up data callback for AI learning - NOW WITH AUTO-TRAINING
    historySyncManager.onData((conversations, messagesByConversation) => {
      // Store data for potential manual re-training
      setFetchedHistoryData({
        conversations: conversations as HostawayConversation[],
        messages: messagesByConversation as Record<number, HostawayMessage[]>,
      });

      updateHistorySyncStatus({ syncPhase: 'analyzing' });

      // Trigger automatic AI training after successful fetch
      console.log('[AI Learning] Starting auto-training after history fetch...');

      const existingProfile = hostStyleProfiles['global'];

      aiTrainingService.autoTrainOnFetch(
        conversations as HostawayConversation[],
        messagesByConversation as Record<number, HostawayMessage[]>,
        existingProfile
      ).then((result) => {
        if (result.success) {
          // Update host style profile with trained data
          updateHostStyleProfile('global', result.styleProfile);

          // Update learning progress
          updateAILearningProgress({
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

          setLastTrainingResult(result);
          setShowTrainingComplete(true);

          console.log(`[AI Learning] Auto-training complete: ${result.stats.hostMessagesAnalyzed} messages, ${result.stats.patternsIndexed} patterns indexed`);
        }
      }).catch((error) => {
        console.error('[AI Learning] Auto-training failed:', error);
      });
    });
  }, []);

  // Initialize background sync manager and check availability
  useEffect(() => {
    // Check background fetch availability
    isBackgroundFetchAvailable().then(({ available, statusText }) => {
      setBackgroundFetchAvailable(available);
      setBackgroundFetchStatusText(statusText);
    });

    // Load background sync state
    backgroundSyncManager.loadState().then((state) => {
      setBackgroundSyncState(state);
      setBackgroundSyncProgress(backgroundSyncManager.getProgress());
    });

    // Subscribe to background sync progress
    const unsubscribe = backgroundSyncManager.onProgress((progress) => {
      setBackgroundSyncProgress(progress);
    });

    // Set up data callback for background sync completion - WITH AUTO-TRAINING
    backgroundSyncManager.onData((conversations, messagesByConversation) => {
      // Store data for potential manual re-training
      setFetchedHistoryData({
        conversations: conversations as HostawayConversation[],
        messages: messagesByConversation as Record<number, HostawayMessage[]>,
      });

      // Trigger automatic AI training after successful background fetch
      console.log('[AI Learning] Starting auto-training after background sync...');

      const existingProfile = hostStyleProfiles['global'];

      aiTrainingService.autoTrainOnFetch(
        conversations as HostawayConversation[],
        messagesByConversation as Record<number, HostawayMessage[]>,
        existingProfile
      ).then((result) => {
        if (result.success) {
          // Update host style profile with trained data
          updateHostStyleProfile('global', result.styleProfile);

          // Update learning progress
          updateAILearningProgress({
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

          setLastTrainingResult(result);
          setShowTrainingComplete(true);

          console.log(`[AI Learning] Background auto-training complete: ${result.stats.hostMessagesAnalyzed} messages, ${result.stats.patternsIndexed} patterns indexed`);
        }
      }).catch((error) => {
        console.error('[AI Learning] Background auto-training failed:', error);
      });
    });

    backgroundSyncManager.onComplete((stats) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Refresh state after completion
      backgroundSyncManager.loadState().then((state) => {
        setBackgroundSyncState(state);
      });
    });

    // Handle app state changes for foreground/background transitions
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Refresh background sync state when returning to foreground
        backgroundSyncManager.loadState().then((state) => {
          setBackgroundSyncState(state);
          setBackgroundSyncProgress(backgroundSyncManager.getProgress());
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, [dateRangeMonths, hostStyleProfiles, updateHostStyleProfile, updateAILearningProgress, aiLearningProgress.totalMessagesAnalyzed]);

  // Subscribe to AI training progress
  useEffect(() => {
    // Load initial training state
    aiTrainingService.loadState().then(() => {
      setTrainingState(aiTrainingService.getState());
    });

    // Subscribe to progress updates
    const unsubscribeProgress = aiTrainingService.onProgress((state) => {
      setTrainingState(state);
      setIsTraining(state.isTraining);

      // Update spinner based on training state
      if (state.isTraining) {
        spinValue.value = withRepeat(
          withTiming(360, { duration: 1000, easing: Easing.linear }),
          -1,
          false
        );
      }
    });

    // Subscribe to completion
    const unsubscribeComplete = aiTrainingService.onComplete((result) => {
      setLastTrainingResult(result);
      if (result.success) {
        setShowTrainingComplete(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
    };
  }, [spinValue]);

  // Calculate current learning stats
  const learningStats = useMemo(() => {
    return calculateLearningProgress(learningEntries);
  }, [learningEntries]);

  // Get host messages count
  const hostMessagesCount = useMemo(() => {
    return conversations.reduce((count, conv) => {
      return count + conv.messages.filter((m) => m.sender === 'host').length;
    }, 0);
  }, [conversations]);

  // Format date for display
  const formatDate = useCallback((date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Start/Resume history fetch using the new sync manager
  const handleStartSync = useCallback(async (resume: boolean = false) => {
    if (!accountId || !apiKey) {
      Alert.alert('Not Connected', 'Please connect your Hostaway account first.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateHistorySyncStatus({
      isSyncing: true,
      isPaused: false,
      syncPhase: 'conversations',
      syncProgress: 0,
      syncError: null,
    });

    const months = parseInt(dateRangeMonths, 10) || 12;

    await historySyncManager.start(accountId, apiKey, {
      dateRangeMonths: months,
      resume,
    });
  }, [accountId, apiKey, dateRangeMonths, updateHistorySyncStatus]);

  // Pause sync
  const handlePauseSync = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    historySyncManager.pause();
    updateHistorySyncStatus({ isPaused: true });
  }, [updateHistorySyncStatus]);

  // Resume from pause
  const handleResumeSync = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    historySyncManager.resume();
    updateHistorySyncStatus({ isPaused: false });
  }, [updateHistorySyncStatus]);

  // Cancel sync
  const handleCancelSync = useCallback(() => {
    Alert.alert(
      'Cancel Sync',
      'Are you sure you want to cancel? Progress will be saved and you can resume later.',
      [
        { text: 'Keep Syncing', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            historySyncManager.cancel();
            updateHistorySyncStatus({
              isSyncing: false,
              isPaused: false,
              syncPhase: 'idle',
              canResume: historySyncManager.canResume(),
            });
          },
        },
      ]
    );
  }, [updateHistorySyncStatus]);

  // Clear sync state and start fresh
  const handleClearAndRestart = useCallback(async () => {
    await historySyncManager.clearState();
    updateHistorySyncStatus({
      canResume: false,
      processedConversations: 0,
      processedMessages: 0,
      syncProgress: 0,
    });
    handleStartSync(false);
  }, [handleStartSync, updateHistorySyncStatus]);

  // Background sync handlers
  const handleEnableBackgroundSync = useCallback(async () => {
    if (!backgroundFetchAvailable) {
      Alert.alert(
        'Background Fetch Unavailable',
        backgroundFetchStatusText || 'Background App Refresh is not available. Please enable it in Settings > General > Background App Refresh.',
        [{ text: 'OK' }]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const months = parseInt(dateRangeMonths, 10) || 12;

    const success = await backgroundSyncManager.enable({
      dateRangeMonths: months,
      startImmediately: true,
    });

    if (success) {
      const state = await backgroundSyncManager.loadState();
      setBackgroundSyncState(state);
      setBackgroundSyncProgress(backgroundSyncManager.getProgress());

      Alert.alert(
        'Background Sync Enabled',
        'History fetch will continue even when the app is in the background. You can close the app and check back later.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Error', 'Failed to enable background sync. Please make sure you are connected to Hostaway.');
    }
  }, [backgroundFetchAvailable, backgroundFetchStatusText, dateRangeMonths]);

  const handleDisableBackgroundSync = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await backgroundSyncManager.disable();
    const state = await backgroundSyncManager.loadState();
    setBackgroundSyncState(state);
    setBackgroundSyncProgress(null);
  }, []);

  const handleResumeBackgroundSyncInForeground = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Resume sync in foreground for faster completion
    await backgroundSyncManager.resumeInForeground();
    const state = await backgroundSyncManager.loadState();
    setBackgroundSyncState(state);
    setBackgroundSyncProgress(backgroundSyncManager.getProgress());
  }, []);

  const handleClearBackgroundSync = useCallback(async () => {
    Alert.alert(
      'Clear Background Sync',
      'This will clear all background sync progress. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await backgroundSyncManager.clearState();
            const state = await backgroundSyncManager.loadState();
            setBackgroundSyncState(state);
            setBackgroundSyncProgress(null);
          },
        },
      ]
    );
  }, []);

  const handleTrainModel = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // If we have fetched history data, use the advanced training service
    if (fetchedHistoryData && fetchedHistoryData.conversations.length > 0) {
      setIsTraining(true);

      try {
        const existingProfile = hostStyleProfiles['global'];
        const result = await aiTrainingService.manualTrain(
          fetchedHistoryData.conversations,
          fetchedHistoryData.messages,
          existingProfile
        );

        if (result.success) {
          updateHostStyleProfile('global', result.styleProfile);
          updateAILearningProgress({
            totalMessagesAnalyzed: result.stats.totalMessagesAnalyzed,
            patternsIndexed: result.stats.patternsIndexed,
            totalEditsLearned: learningEntries.filter((e) => e.wasEdited).length + aiLearningProgress.realTimeEditsCount,
            totalApprovalsLearned: learningEntries.filter((e) => e.wasApproved).length + aiLearningProgress.realTimeApprovalsCount,
            accuracyScore: learningStats.accuracyScore,
            lastTrainingDate: new Date(),
            lastTrainingResult: {
              hostMessagesAnalyzed: result.stats.hostMessagesAnalyzed,
              patternsIndexed: result.stats.patternsIndexed,
              trainingSampleSize: result.stats.trainingSampleSize,
              trainingDurationMs: result.stats.trainingDurationMs,
            },
          });

          setLastTrainingResult(result);
          setShowTrainingComplete(true);
        }
      } catch (error) {
        console.error('Training error:', error);
        Alert.alert('Training Error', 'An error occurred during training. Please try again.');
      } finally {
        setIsTraining(false);
      }
      return;
    }

    // Fallback to basic local conversation analysis if no history data
    if (conversations.length === 0) {
      Alert.alert(
        'No Messages to Train On',
        'Fetch your message history first by tapping "Import All History" below, then try training again.',
        [{ text: 'Got It' }]
      );
      return;
    }
    setIsTraining(true);
    updateAILearningProgress({ isTraining: true, trainingProgress: 0 });

    try {
      // Simulate training progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        updateAILearningProgress({ trainingProgress: i });
      }

      // Analyze global style
      const globalProfile = analyzeConversationsForStyle(conversations);
      updateHostStyleProfile('global', globalProfile);

      // Analyze per-property styles
      for (const property of properties) {
        const propertyProfile = analyzeConversationsForStyle(conversations, property.id);
        if (propertyProfile.samplesAnalyzed && propertyProfile.samplesAnalyzed > 0) {
          updateHostStyleProfile(property.id, propertyProfile);
        }
      }

      updateAILearningProgress({
        isTraining: false,
        trainingProgress: 100,
        totalMessagesAnalyzed: hostMessagesCount,
        totalEditsLearned: learningEntries.filter((e) => e.wasEdited).length + aiLearningProgress.realTimeEditsCount,
        totalApprovalsLearned: learningEntries.filter((e) => e.wasApproved).length + aiLearningProgress.realTimeApprovalsCount,
        accuracyScore: learningStats.accuracyScore,
        lastTrainingDate: new Date(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Training error:', error);
      updateAILearningProgress({ isTraining: false });
    } finally {
      setIsTraining(false);
    }
  };

  const handleResetLearning = () => {
    Alert.alert(
      'Reset AI Learning',
      'This will erase all learned patterns and style preferences. The AI will start fresh. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            resetAILearning();
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <LinearGradient
        colors={['#F3F4F6', '#F3F4F6']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Training Complete Notification */}
        {showTrainingComplete && lastTrainingResult && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{ marginHorizontal: spacing['4'], marginBottom: spacing['4'], backgroundColor: colors.success.muted, borderWidth: 1, borderColor: colors.success.DEFAULT, borderRadius: radius['2xl'], padding: spacing['4'] }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.success.muted, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] }}>
                  <Zap size={20} color="#22C55E" />
                </View>
                <View>
                  <Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.semibold, fontSize: 16 }}>AI Fully Trained!</Text>
                  <Text style={{ color: colors.success.DEFAULT, fontSize: 12 }}>Now answers accurately in your voice</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowTrainingComplete(false)}
                style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.7 : 1 })}
              >
                <X size={18} color="#22C55E" />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing['2'], paddingTop: spacing['2'], borderTopWidth: 1, borderTopColor: colors.success.muted }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.bold, fontSize: 18 }}>
                  {lastTrainingResult.stats.hostMessagesAnalyzed.toLocaleString()}
                </Text>
                <Text style={{ color: colors.success.DEFAULT, fontSize: 12 }}>Messages Analyzed</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.bold, fontSize: 18 }}>
                  {lastTrainingResult.stats.patternsIndexed.toLocaleString()}
                </Text>
                <Text style={{ color: colors.success.DEFAULT, fontSize: 12 }}>Patterns Indexed</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.bold, fontSize: 18 }}>
                  {Math.round(lastTrainingResult.stats.trainingDurationMs / 1000)}s
                </Text>
                <Text style={{ color: colors.success.DEFAULT, fontSize: 12 }}>Training Time</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Auto-Training Progress Banner */}
        {trainingState?.isAutoTraining && trainingState.isTraining && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{ marginBottom: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: 12, padding: 12, marginHorizontal: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Animated.View style={spinStyle}>
                <RefreshCw size={16} color="#A855F7" />
              </Animated.View>
              <Text style={{ color: colors.primary.DEFAULT, fontWeight: '500', fontSize: 14, marginLeft: 8 }}>
                Auto-training on your history...
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: 14, marginLeft: 'auto' }}>
                {trainingState.progress}%
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: colors.bg.hover, borderRadius: 9999, overflow: 'hidden' }}>
              <View
                style={{ backgroundColor: colors.primary.DEFAULT, borderRadius: 9999, height: '100%', width: `${trainingState.progress}%` }}
              />
            </View>
            <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 8 }}>
              {formatTrainingStatus(trainingState)}
            </Text>
          </Animated.View>
        )}

        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 9999, backgroundColor: colors.bg.hover, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 12, opacity: pressed ? 0.7 : 1 })}
          >
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text.primary }}>AI Learning</Text>
        </Animated.View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
          {/* Learning Status Card */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            style={{ borderRadius: 16, padding: 20, marginBottom: 24, backgroundColor: '#FFFFFF' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 9999, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Brain size={24} color="#A855F7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.primary, fontWeight: '600', fontSize: 18 }}>Style Learning</Text>
                <Text style={{ color: colors.text.muted, fontSize: 14 }}>
                  {learningStats.totalAnalyzed > 0
                    ? `Learning from ${learningStats.totalAnalyzed} interactions`
                    : 'Ready to learn your communication style'}
                </Text>
              </View>
            </View>

            {/* Profile Strength Meter */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: colors.text.muted, fontSize: 14 }}>Profile Strength</Text>
                <Text style={{ color: colors.primary.DEFAULT, fontWeight: '600' }}>
                  {(() => {
                    const count = aiLearningProgress?.totalMessagesAnalyzed || learningStats.totalAnalyzed || 0;
                    if (count >= 500) return 'Expert';
                    if (count >= 200) return 'Strong';
                    if (count >= 50) return 'Learning';
                    if (count > 0) return 'Building';
                    return 'Not Started';
                  })()}
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.bg.hover, borderRadius: 9999, overflow: 'hidden' }}>
                <View
                  style={{ backgroundColor: colors.primary.DEFAULT, borderRadius: 9999, height: '100%', width: `${Math.min(((aiLearningProgress?.totalMessagesAnalyzed || learningStats.totalAnalyzed || 0) / 500) * 100, 100)}%` }}
                />
              </View>
              <Text style={{ color: colors.text.disabled, fontSize: 12, marginTop: 4 }}>
                {aiLearningProgress?.totalMessagesAnalyzed || learningStats.totalAnalyzed || 0} messages trained
              </Text>
            </View>

            {/* Training Button */}
            <Pressable
              onPress={handleTrainModel}
              disabled={isTraining || (trainingState?.isTraining ?? false)}
              style={({ pressed }) => ({ borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: isTraining || trainingState?.isTraining ? '#334155' : '#A855F7', opacity: pressed ? 0.8 : 1 })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isTraining || trainingState?.isTraining ? (
                  <>
                    <Animated.View style={spinStyle}>
                      <RefreshCw size={18} color="#A855F7" />
                    </Animated.View>
                    <Text style={{ color: colors.primary.DEFAULT, fontWeight: '600', marginLeft: 8 }}>
                      Training... {trainingState?.progress ?? aiLearningProgress.trainingProgress}%
                    </Text>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} color="#FFFFFF" />
                    <Text style={{ color: colors.text.primary, fontWeight: '600', marginLeft: 8 }}>Train on Messages</Text>
                  </>
                )}
              </View>
            </Pressable>

            {/* Training Summary */}
            {(trainingState?.hasCompletedInitialTraining || aiLearningProgress.lastTrainingResult) && !isTraining && (
              <Text style={{ color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
                {trainingState?.hasCompletedInitialTraining
                  ? getTrainingSummary(trainingState)
                  : aiLearningProgress.lastTrainingResult
                    ? `Trained on ${aiLearningProgress.lastTrainingResult.hostMessagesAnalyzed.toLocaleString()} messages • ${aiLearningProgress.lastTrainingResult.patternsIndexed.toLocaleString()} patterns indexed`
                    : null}
              </Text>
            )}
          </Animated.View>

          {/* Stats Grid */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
              Learning Statistics
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <View style={{ width: '50%', paddingRight: 8, marginBottom: 12 }}>
                <View style={{ backgroundColor: colors.bg.hover, borderRadius: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <BarChart3 size={16} color="#14B8A6" />
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 8 }}>Messages Analyzed</Text>
                  </View>
                  <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700' }}>
                    {aiLearningProgress.totalMessagesAnalyzed || hostMessagesCount}
                  </Text>
                </View>
              </View>

              <View style={{ width: '50%', paddingLeft: 8, marginBottom: 12 }}>
                <View style={{ backgroundColor: colors.bg.hover, borderRadius: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <TrendingUp size={16} color="#A855F7" />
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 8 }}>Approval Rate</Text>
                  </View>
                  <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700' }}>{learningStats.approvalRate}%</Text>
                </View>
              </View>

              <View style={{ width: '50%', paddingRight: 8 }}>
                <View style={{ backgroundColor: colors.bg.hover, borderRadius: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <CheckCircle size={16} color="#22C55E" />
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 8 }}>Approvals</Text>
                  </View>
                  <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700' }}>
                    {aiLearningProgress.realTimeApprovalsCount + learningEntries.filter((e) => e.wasApproved && !e.wasEdited).length}
                  </Text>
                </View>
              </View>

              <View style={{ width: '50%', paddingLeft: 8 }}>
                <View style={{ backgroundColor: colors.bg.hover, borderRadius: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Edit3 size={16} color="#F59E0B" />
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 8 }}>Edits + Corrections</Text>
                  </View>
                  <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700' }}>
                    {aiLearningProgress.realTimeEditsCount + aiLearningProgress.realTimeIndependentRepliesCount + learningEntries.filter((e) => e.wasEdited).length}
                  </Text>
                </View>
              </View>

              <View style={{ width: '50%', paddingRight: 8, marginTop: 12 }}>
                <View style={{ backgroundColor: colors.bg.hover, borderRadius: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Sparkles size={16} color="#60A5FA" />
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 8 }}>Patterns Indexed</Text>
                  </View>
                  <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700' }}>
                    {aiLearningProgress.patternsIndexed || (aiLearningProgress.lastTrainingResult?.patternsIndexed ?? 0)}
                  </Text>
                </View>
              </View>

              <View style={{ width: '50%', paddingLeft: 8, marginTop: 12 }}>
                <View style={{ backgroundColor: colors.bg.hover, borderRadius: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <X size={16} color="#EF4444" />
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 8 }}>Rejections Noted</Text>
                  </View>
                  <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700' }}>
                    {aiLearningProgress.realTimeRejectionsCount}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ── TIER 2: Accuracy Dashboard ── */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
              Accuracy Trend
            </Text>
            <View style={{ backgroundColor: colors.bg.card, borderRadius: 16, padding: 16 }}>
              {(() => {
                const outcomes = draftOutcomes || [];
                if (outcomes.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                      <TrendingUp size={24} color="#475569" />
                      <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                        Start approving or editing AI drafts to track accuracy over time
                      </Text>
                    </View>
                  );
                }

                // Group by week (last 4 weeks)
                const now = new Date();
                const weeks: { label: string; approved: number; total: number }[] = [];
                for (let w = 3; w >= 0; w--) {
                  const weekStart = new Date(now.getTime() - (w + 1) * 7 * 86400000);
                  const weekEnd = new Date(now.getTime() - w * 7 * 86400000);
                  const weekOutcomes = outcomes.filter((o) => {
                    const t = new Date(o.timestamp).getTime();
                    return t >= weekStart.getTime() && t < weekEnd.getTime();
                  });
                  const approved = weekOutcomes.filter((o) => o.outcomeType === 'approved').length;
                  weeks.push({
                    label: w === 0 ? 'This Week' : w === 1 ? 'Last Week' : `${w + 1}w ago`,
                    approved,
                    total: weekOutcomes.length,
                  });
                }

                // Also calculate all-time rate
                const totalApproved = outcomes.filter((o) => o.outcomeType === 'approved').length;
                const totalEdited = outcomes.filter((o) => o.outcomeType === 'edited').length;
                const allTimeRate = outcomes.length > 0 ? Math.round(((totalApproved + totalEdited) / outcomes.length) * 100) : 0;

                return (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                      <View>
                        <Text style={{ color: colors.text.muted, fontSize: 12 }}>Overall Acceptance</Text>
                        <Text style={{ color: colors.text.primary, fontSize: 28, fontWeight: '700' }}>{allTimeRate}%</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: colors.text.muted, fontSize: 12 }}>Total Drafts</Text>
                        <Text style={{ color: colors.text.primary, fontSize: 28, fontWeight: '700' }}>{outcomes.length}</Text>
                      </View>
                    </View>

                    {/* Weekly bar chart */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 60 }}>
                      {weeks.map((week, i) => {
                        const rate = week.total > 0 ? (week.approved / week.total) : 0;
                        const barHeight = Math.max(8, rate * 50);
                        const color = rate >= 0.7 ? '#22C55E' : rate >= 0.4 ? '#F59E0B' : '#EF4444';
                        return (
                          <View key={i.toString()} style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: colors.text.muted, fontSize: 10, marginBottom: 4 }}>
                              {week.total > 0 ? `${Math.round(rate * 100)}%` : '—'}
                            </Text>
                            <View style={{ width: 24, height: barHeight, backgroundColor: week.total > 0 ? color : '#334155', borderRadius: 4 }} />
                            <Text style={{ color: '#64748B', fontSize: 10, marginTop: 4 }}>{week.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                );
              })()}
            </View>
          </Animated.View>

          {/* ── TIER 2: What I Learned Summary ── */}
          <Animated.View entering={FadeInDown.delay(350).duration(400)} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
              What I Learned
            </Text>
            <View style={{ backgroundColor: colors.bg.card, borderRadius: 16, padding: 16 }}>
              {(() => {
                const globalProfile = hostStyleProfiles['global'];
                if (!globalProfile || globalProfile.samplesAnalyzed === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                      <Brain size={24} color="#475569" />
                      <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                        Train on your message history to see what the AI learned about your style
                      </Text>
                    </View>
                  );
                }

                const formalityLabel = globalProfile.formalityLevel < 30 ? 'Casual' : globalProfile.formalityLevel < 60 ? 'Balanced' : 'Formal';
                const warmthLabel = globalProfile.warmthLevel < 30 ? 'Direct' : globalProfile.warmthLevel < 60 ? 'Friendly' : 'Very Warm';
                const lengthLabel = globalProfile.averageResponseLength < 30 ? 'Brief' : globalProfile.averageResponseLength < 80 ? 'Medium' : 'Detailed';

                return (
                  <View style={{ gap: 12 }}>
                    {/* Greeting */}
                    {globalProfile.commonGreetings.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#22C55E', fontSize: 14, marginRight: 8 }}>👋</Text>
                        <Text style={{ color: colors.text.muted, fontSize: 13, flex: 1 }}>
                          Typical greeting: <Text style={{ color: colors.text.primary, fontWeight: '500' }}>"{globalProfile.commonGreetings[0]}"</Text>
                        </Text>
                      </View>
                    )}

                    {/* Tone */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: colors.primary.DEFAULT, fontSize: 14, marginRight: 8 }}>🎭</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 13, flex: 1 }}>
                        Tone: <Text style={{ color: colors.text.primary, fontWeight: '500' }}>{formalityLabel}, {warmthLabel}</Text>
                      </Text>
                    </View>

                    {/* Length */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: '#14B8A6', fontSize: 14, marginRight: 8 }}>📏</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 13, flex: 1 }}>
                        Response length: <Text style={{ color: colors.text.primary, fontWeight: '500' }}>{lengthLabel} (~{Math.round(globalProfile.averageResponseLength)} words)</Text>
                      </Text>
                    </View>

                    {/* Emoji usage */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: colors.warning.DEFAULT, fontSize: 14, marginRight: 8 }}>{globalProfile.usesEmojis ? '😊' : '📝'}</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 13, flex: 1 }}>
                        Emojis: <Text style={{ color: colors.text.primary, fontWeight: '500' }}>{globalProfile.usesEmojis ? `Yes (${globalProfile.emojiFrequency}% of messages)` : 'Rarely used'}</Text>
                      </Text>
                    </View>

                    {/* Sign-off */}
                    {globalProfile.commonSignoffs.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#60A5FA', fontSize: 14, marginRight: 8 }}>✍️</Text>
                        <Text style={{ color: colors.text.muted, fontSize: 13, flex: 1 }}>
                          Sign-off: <Text style={{ color: colors.text.primary, fontWeight: '500' }}>"{globalProfile.commonSignoffs[0]}"</Text>
                        </Text>
                      </View>
                    )}

                    {/* Samples analyzed */}
                    <Text style={{ color: '#475569', fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                      Based on {globalProfile.samplesAnalyzed} messages analyzed
                    </Text>
                  </View>
                );
              })()}
            </View>
          </Animated.View>

          {/* ── TIER 2: Style Profile Editor ── */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
              Style Preferences
            </Text>
            <View style={{ backgroundColor: colors.bg.card, borderRadius: 16, padding: 16 }}>
              {(() => {
                const globalProfile = hostStyleProfiles['global'];
                if (!globalProfile) {
                  return (
                    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                      <Sliders size={24} color="#475569" />
                      <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                        Train on messages first to unlock style controls
                      </Text>
                    </View>
                  );
                }

                return (
                  <View style={{ gap: 20 }}>
                    {/* Formality Slider */}
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: colors.text.muted, fontSize: 13 }}>Formality</Text>
                        <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>
                          {globalProfile.formalityLevel < 30 ? 'Casual' : globalProfile.formalityLevel < 60 ? 'Balanced' : 'Formal'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#64748B', fontSize: 11, marginRight: 8 }}>Casual</Text>
                        <View style={{ flex: 1, height: 6, backgroundColor: colors.bg.elevated, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ width: `${globalProfile.formalityLevel}%`, height: '100%', backgroundColor: colors.primary.DEFAULT, borderRadius: 3 }} />
                        </View>
                        <Text style={{ color: '#64748B', fontSize: 11, marginLeft: 8 }}>Formal</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
                        {[20, 40, 60, 80].map((val) => (
                          <Pressable
                            key={val}
                            onPress={() => updateHostStyleProfile('global', { formalityLevel: val })}
                            style={({ pressed }) => ({
                              paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8,
                              backgroundColor: Math.abs(globalProfile.formalityLevel - val) < 15 ? '#A855F720' : 'transparent',
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text style={{ color: Math.abs(globalProfile.formalityLevel - val) < 15 ? '#A855F7' : '#64748B', fontSize: 11 }}>
                              {val === 20 ? '😎' : val === 40 ? '🙂' : val === 60 ? '🤝' : '👔'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    {/* Warmth Slider */}
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: colors.text.muted, fontSize: 13 }}>Warmth</Text>
                        <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>
                          {globalProfile.warmthLevel < 30 ? 'Direct' : globalProfile.warmthLevel < 60 ? 'Friendly' : 'Very Warm'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#64748B', fontSize: 11, marginRight: 8 }}>Direct</Text>
                        <View style={{ flex: 1, height: 6, backgroundColor: colors.bg.elevated, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ width: `${globalProfile.warmthLevel}%`, height: '100%', backgroundColor: colors.warning.DEFAULT, borderRadius: 3 }} />
                        </View>
                        <Text style={{ color: '#64748B', fontSize: 11, marginLeft: 8 }}>Warm</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
                        {[20, 40, 60, 80].map((val) => (
                          <Pressable
                            key={val}
                            onPress={() => updateHostStyleProfile('global', { warmthLevel: val })}
                            style={({ pressed }) => ({
                              paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8,
                              backgroundColor: Math.abs(globalProfile.warmthLevel - val) < 15 ? '#F59E0B20' : 'transparent',
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text style={{ color: Math.abs(globalProfile.warmthLevel - val) < 15 ? '#F59E0B' : '#64748B', fontSize: 11 }}>
                              {val === 20 ? '📋' : val === 40 ? '🙂' : val === 60 ? '😊' : '🤗'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    {/* Emoji Toggle */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ color: colors.text.muted, fontSize: 13 }}>Use Emojis</Text>
                        <Text style={{ color: '#64748B', fontSize: 11 }}>Include emojis in AI responses</Text>
                      </View>
                      <Pressable
                        onPress={() => updateHostStyleProfile('global', { usesEmojis: !globalProfile.usesEmojis })}
                        style={{
                          width: 48, height: 28, borderRadius: 14,
                          backgroundColor: globalProfile.usesEmojis ? '#22C55E' : '#334155',
                          justifyContent: 'center',
                          paddingHorizontal: 2,
                        }}
                      >
                        <View style={{
                          width: 24, height: 24, borderRadius: 12,
                          backgroundColor: '#FFFFFF',
                          alignSelf: globalProfile.usesEmojis ? 'flex-end' : 'flex-start',
                        }} />
                      </Pressable>
                    </View>

                    {/* Response Length Preference */}
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: colors.text.muted, fontSize: 13 }}>Response Length</Text>
                        <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>
                          ~{Math.round(globalProfile.averageResponseLength)} words
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                        {[
                          { label: 'Brief', value: 25, icon: '📝' },
                          { label: 'Medium', value: 50, icon: '📄' },
                          { label: 'Detailed', value: 100, icon: '📋' },
                        ].map((opt) => (
                          <Pressable
                            key={opt.value}
                            onPress={() => updateHostStyleProfile('global', { averageResponseLength: opt.value })}
                            style={({ pressed }) => ({
                              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
                              backgroundColor: Math.abs(globalProfile.averageResponseLength - opt.value) < 20 ? '#14B8A620' : '#1E293B',
                              opacity: pressed ? 0.7 : 1, alignItems: 'center',
                            })}
                          >
                            <Text style={{ fontSize: 18, marginBottom: 2 }}>{opt.icon}</Text>
                            <Text style={{ color: Math.abs(globalProfile.averageResponseLength - opt.value) < 20 ? '#14B8A6' : '#64748B', fontSize: 11, fontWeight: '500' }}>
                              {opt.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          </Animated.View>

          {/* ── TIER 2: Per-Property Style Comparison ── */}
          {Object.keys(hostStyleProfiles).filter((k) => k !== 'global').length > 0 && (
            <Animated.View entering={FadeInDown.delay(450).duration(400)} style={{ marginBottom: 24 }}>
              <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
                Per-Property Styles
              </Text>
              <View style={{ gap: 8 }}>
                {Object.entries(hostStyleProfiles)
                  .filter(([k]) => k !== 'global')
                  .map(([propertyId, profile]) => {
                    const property = properties.find((p) => p.id === propertyId);
                    const propertyName = property?.name || `Property ${propertyId}`;
                    const p = profile as any;
                    const fLabel = p.formalityLevel < 30 ? 'Casual' : p.formalityLevel < 60 ? 'Balanced' : 'Formal';
                    const wLabel = p.warmthLevel < 30 ? 'Direct' : p.warmthLevel < 60 ? 'Friendly' : 'Warm';

                    return (
                      <View key={propertyId.toString()} style={{ backgroundColor: colors.bg.hover, borderRadius: 12, padding: 14 }}>
                        <Text style={{ color: colors.text.primary, fontWeight: '600', fontSize: 14, marginBottom: 6 }}>
                          🏠 {propertyName}
                        </Text>
                        <Text style={{ color: colors.text.muted, fontSize: 12 }}>
                          {fLabel} • {wLabel} • {p.usesEmojis ? '😊 Emojis' : 'No emojis'} • ~{Math.round(p.averageResponseLength)} words
                        </Text>
                        <Text style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                          {p.samplesAnalyzed} samples analyzed
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </Animated.View>
          )}

          {/* ── TIER 3: Confidence Calibration Dashboard ── */}
          {calSummary && (() => {
            const gaugeColor = calSummary.calibrationScore >= 70 ? '#10B981'
              : calSummary.calibrationScore >= 40 ? '#F59E0B' : '#EF4444';
            return (
              <Animated.View entering={FadeInDown.delay(500).duration(400)} style={{ marginBottom: 24 }}>
                <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
                  🎯 Confidence Calibration
                </Text>
                <View style={{ backgroundColor: colors.bg.card, borderRadius: 16, padding: 16 }}>
                  {/* Calibration Score */}
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: gaugeColor, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: gaugeColor, fontSize: 24, fontWeight: '800' }}>{calSummary.calibrationScore}</Text>
                    </View>
                    <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 6 }}>Calibration Score</Text>
                  </View>

                  {/* Breakdown Row */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#10B981', fontSize: 18, fontWeight: '700' }}>{calSummary.calibratedCount}</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 10 }}>Calibrated</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: colors.warning.DEFAULT, fontSize: 18, fontWeight: '700' }}>{calSummary.overconfidentCount}</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 10 }}>Overconfident</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#6366F1', fontSize: 18, fontWeight: '700' }}>{calSummary.underconfidentCount}</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 10 }}>Underconfident</Text>
                    </View>
                  </View>

                  {/* Averages */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: colors.text.muted, fontSize: 12 }}>Avg confidence when approved:</Text>
                    <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>{calSummary.avgConfidenceWhenApproved}%</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: colors.text.muted, fontSize: 12 }}>Avg confidence when rejected:</Text>
                    <Text style={{ color: colors.danger.DEFAULT, fontSize: 12, fontWeight: '600' }}>{calSummary.avgConfidenceWhenRejected}%</Text>
                  </View>

                  {/* Adjustment Recommendation */}
                  {calSummary.confidenceAdjustment !== 0 && (
                    <View style={{ backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 10, padding: 10, marginTop: 8 }}>
                      <Text style={{ color: '#A5B4FC', fontSize: 12 }}>
                        {calSummary.confidenceAdjustment < 0
                          ? `⚠️ AI is overconfident by ~${Math.abs(calSummary.confidenceAdjustment)}%. Adjusting threshold down.`
                          : `💡 AI is underconfident by ~${calSummary.confidenceAdjustment}%. Could safely increase auto-pilot.`}
                      </Text>
                    </View>
                  )}

                  {/* Problem Intents */}
                  {calSummary.problemIntents.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>Problem Areas:</Text>
                      {calSummary.problemIntents.slice(0, 3).map((pi, idx) => (
                        <View key={idx.toString()}>
                          <Text style={{ color: pi.issue === 'overconfident' ? '#F59E0B' : '#6366F1', fontSize: 11, marginBottom: 2 }}>
                            • {pi.intent.replace(/_/g, ' ')}: {pi.issue} ({pi.count}x)
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </Animated.View>
            );
          })()}

          {/* ── TIER 3: Voice DNA Export ── */}
          {hostStyleProfiles['global'] && (() => {
            const profile = hostStyleProfiles['global'];
            return (
              <Animated.View entering={FadeInDown.delay(550).duration(400)}>
                <SectionHeader title="Voice DNA" />
                <View style={s.card}>
                  <ValueRow 
                    icon={<MessageSquare size={18} color={colors.primary.DEFAULT} />}
                    label="Typical Length" 
                    value={`${profile.averageResponseLength} chars`}
                  />
                  <ValueRow 
                    icon={<Sparkles size={18} color={colors.primary.DEFAULT} />}
                    label="Tone" 
                    value={String(profile.formalityLevel) === 'formal' ? 'Professional' : String(profile.formalityLevel) === 'casual' ? 'Relaxed' : 'Balanced'}
                  />
                  <ValueRow 
                    icon={<Brain size={18} color={colors.primary.DEFAULT} />}
                    label="Emojis" 
                    value={profile.usesEmojis === true ? 'Frequently Used' : 'Never Used'}
                  />
                  <Row 
                    icon={<FileText size={18} color={colors.primary.DEFAULT} />}
                    label="Copy Voice DNA" 
                    right={<Text style={s.tealValue}>Copy</Text>}
                    onPress={() => {
                      const dna = generateVoiceDNA(profile);
                      Clipboard.setStringAsync(dna);
                      Alert.alert('Copied!', 'Voice DNA copied to clipboard. Paste it into any AI\'s system prompt.');
                    }}
                    isLast
                  />
                </View>
                <SectionFooter text="Your portable communication fingerprint. Copied DNA can be pasted into any AI to clone your voice." />
              </Animated.View>
            );
          })()}

          {/* ── TIER 3: Reply Delta Insights ── */}
          {deltaStats && (() => {
            const { hostMoreSpecific, totalAdded, totalRemoved, recentDeltas } = deltaStats;

            return (
              <Animated.View entering={FadeInDown.delay(600).duration(400)} style={{ marginBottom: 24 }}>
                <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
                  🔬 Deep Edit Analysis
                </Text>
                <View style={{ backgroundColor: colors.bg.card, borderRadius: 16, padding: 16 }}>
                  {/* Summary Stats */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#10B981', fontSize: 18, fontWeight: '700' }}>{totalAdded}</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 10 }}>Info Added</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: colors.danger.DEFAULT, fontSize: 18, fontWeight: '700' }}>{totalRemoved}</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 10 }}>Info Removed</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#6366F1', fontSize: 18, fontWeight: '700' }}>{hostMoreSpecific}</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 10 }}>Host Specific</Text>
                    </View>
                  </View>

                  {/* Recent Delta Log */}
                  <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>Recent Corrections:</Text>
                  {recentDeltas.map((delta, idx) => (
                    <View key={String(delta.id) || `delta-${idx}`} style={{ backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                      <Text style={{ color: colors.text.muted, fontSize: 12, marginBottom: 2 }}>
                        {delta.learningSummary}
                      </Text>
                      {delta.specificExamples.length > 0 && (
                        <Text style={{ color: '#64748B', fontSize: 10, fontStyle: 'italic' }}>
                          {delta.specificExamples[0]}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </Animated.View>
            );
          })()}

          {/* ── TIER 3: Conversation Flow Predictions ── */}
          {conversationFlows.length > 0 && (
            <Animated.View entering={FadeInDown.delay(650).duration(400)} style={{ marginBottom: 24 }}>
              <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
                🔄 Conversation Patterns
              </Text>
              <View style={{ backgroundColor: colors.bg.card, borderRadius: 16, padding: 16 }}>
                <Text style={{ color: colors.text.muted, fontSize: 12, marginBottom: 12 }}>
                  Detected {conversationFlows.length} recurring conversation patterns from your history.
                </Text>
                {conversationFlows.slice(0, 5).map((flow, idx) => (
                  <View key={String(flow.id) || `flow-${idx}`} style={{ backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 10, marginBottom: 6 }}>
                    <Text style={{ color: '#E2E8F0', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                      {flow.intentSequence.map(i => i.replace(/_/g, ' ')).join(' → ')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: colors.text.muted, fontSize: 11 }}>
                        Seen {flow.frequency}x
                      </Text>
                      {flow.predictedNextIntent && (
                        <View style={{ backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: '#A5B4FC', fontSize: 10, fontWeight: '600' }}>
                            → {flow.predictedNextIntent.replace(/_/g, ' ')} ({flow.predictionConfidence}%)
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Historical Data Fetch Section */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <SectionHeader title="Historical Importer" />
            <View style={s.card}>
              
              {/* Sync Status / Progress */}
              {historySyncStatus.isSyncing ? (
                <View style={{ padding: 16 }}>
...
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.text.muted, fontSize: 13, fontFamily: typography.fontFamily.medium }}>
                      {historySyncStatus.isPaused
                        ? 'Paused'
                        : historySyncStatus.syncPhase === 'conversations'
                        ? 'Fetching conversations...'
                        : historySyncStatus.syncPhase === 'messages'
                        ? `Fetching messages (${historySyncStatus.processedConversations}/${syncProgress?.totalConversations || '?'})...`
                        : 'Analyzing patterns...'}
                    </Text>
                    <Text style={{ color: '#0EA5E9', fontSize: 13, fontFamily: typography.fontFamily.semibold }}>
                      {historySyncStatus.syncProgress}%
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={{ height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginVertical: 8 }}>
                    <View
                      style={{ height: '100%', borderRadius: 3, backgroundColor: historySyncStatus.isPaused ? '#F59E0B' : '#0EA5E9', width: `${historySyncStatus.syncProgress}%` }}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: '#64748B', fontSize: 12 }}>
                      {historySyncStatus.processedMessages} messages fetched
                    </Text>
                    <Text style={{ color: '#64748B', fontSize: 12 }}>
                      {formatTimeRemaining(historySyncStatus.estimatedTimeRemaining)}
                    </Text>
                  </View>

                  {/* Control Buttons */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {historySyncStatus.isPaused ? (
                      <Pressable
                        onPress={handleResumeSync}
                        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary.DEFAULT, borderRadius: 8, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}
                      >
                        <Play size={14} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontWeight: '500', fontSize: 14, marginLeft: 6 }}>Resume</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={handlePauseSync}
                        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B', borderRadius: 8, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}
                      >
                        <Pause size={14} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontWeight: '500', fontSize: 14, marginLeft: 6 }}>Pause</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={handleCancelSync}
                      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', borderRadius: 8, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}
                    >
                      <Square size={14} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '500', fontSize: 14, marginLeft: 6 }}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  {/* Idle/Complete State Info */}
                  {historySyncStatus.lastFullSync && (
                    <>
                      <ValueRow
                        icon={<Clock size={18} color={colors.primary.DEFAULT} />}
                        label="Last synced"
                        value={formatDate(historySyncStatus.lastFullSync)}
                      />
                      <ValueRow
                        icon={<Database size={18} color={colors.primary.DEFAULT} />}
                        label="Data imported"
                        value={`${historySyncStatus.totalConversationsSynced} convos, ${historySyncStatus.totalMessagesSynced} msgs`}
                      />
                    </>
                  )}

                  {/* Resume Options (if incomplete) */}
                  {historySyncStatus.canResume && (
                    <View style={{ padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', backgroundColor: '#FEF3C7' }}>
                      <Text style={{ color: '#D97706', fontSize: 13, fontFamily: typography.fontFamily.medium, marginBottom: 8 }}>
                        Previous sync incomplete. {historySyncStatus.processedConversations} conversations processed.
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => handleStartSync(true)}
                          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary.DEFAULT, borderRadius: 8, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}
                        >
                          <Play size={14} color="#FFFFFF" />
                          <Text style={{ color: '#FFFFFF', fontWeight: '500', fontSize: 14, marginLeft: 6 }}>Resume</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleClearAndRestart}
                          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0', borderRadius: 8, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}
                        >
                          <RefreshCw size={14} color="#64748B" />
                          <Text style={{ color: '#475569', fontWeight: '500', fontSize: 14, marginLeft: 6 }}>Start Fresh</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* Date Range Selector */}
                  <Row
                    icon={<Calendar size={18} color={colors.primary.DEFAULT} />}
                    label="Date Range"
                    right={<Text style={{ color: '#6B7280', fontSize: 16 }}>Last {dateRangeMonths} months</Text>}
                    onPress={() => setShowDateRangeModal(true)}
                  />

                  {/* Import Button */}
                  <LinkRow
                    icon={<Download size={18} color={colors.primary.DEFAULT} />}
                    label={!accountId ? "Connect Hostaway First" : historySyncStatus.lastFullSync ? "Fetch More History" : "Import All History"}
                    onPress={() => {
                      if (accountId) handleStartSync(false);
                    }}
                    isLast
                  />
                </>
              )}
            </View>
            <SectionFooter text="Only anonymized patterns are stored. No personal data is saved remotely." />
          </Animated.View>

          {/* Background Sync Section */}
          <Animated.View entering={FadeInDown.delay(275).duration(400)} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
              Background Sync
            </Text>
            <View style={{ backgroundColor: colors.bg.card, borderRadius: 16, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Moon size={20} color="#A855F7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontWeight: '500' }}>Continue in Background</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 2 }}>
                    Sync history even when the app is closed
                  </Text>
                </View>
              </View>

              {/* Background Fetch Status */}
              <View style={{ backgroundColor: 'rgba(51,65,85,0.5)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: colors.text.muted, fontSize: 12 }}>System Status</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {backgroundFetchAvailable === null ? (
                      <Text style={{ color: '#64748B', fontSize: 12 }}>Checking...</Text>
                    ) : backgroundFetchAvailable ? (
                      <>
                        <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.success.DEFAULT, marginRight: 6 }} />
                        <Text style={{ color: '#4ADE80', fontSize: 12 }}>Available</Text>
                      </>
                    ) : (
                      <>
                        <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: '#F97316', marginRight: 6 }} />
                        <Text style={{ color: '#FB923C', fontSize: 12 }}>Limited</Text>
                      </>
                    )}
                  </View>
                </View>
                {!backgroundFetchAvailable && backgroundFetchStatusText && (
                  <Text style={{ color: '#64748B', fontSize: 12 }}>{backgroundFetchStatusText}</Text>
                )}
              </View>

              {/* Background Sync Progress */}
              {backgroundSyncState?.isEnabled && backgroundSyncProgress && (
                <View style={{ backgroundColor: '#A855F710', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {backgroundSyncProgress.isRunning ? (
                        <Animated.View style={spinStyle}>
                          <RefreshCw size={14} color="#A855F7" />
                        </Animated.View>
                      ) : (
                        <Moon size={14} color="#A855F7" />
                      )}
                      <Text style={{ color: colors.primary.DEFAULT, fontWeight: '500', fontSize: 14, marginLeft: 8 }}>
                        {backgroundSyncProgress.isRunning ? 'Syncing...' : 'Waiting for background run'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.primary.DEFAULT, fontSize: 12, fontWeight: '500' }}>
                      {backgroundSyncProgress.percentage}%
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={{ height: 8, backgroundColor: colors.bg.hover, borderRadius: 9999, overflow: 'hidden', marginBottom: 8 }}>
                    <View
                      style={{ backgroundColor: colors.primary.DEFAULT, borderRadius: 9999, height: '100%', width: `${backgroundSyncProgress.percentage}%` }}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#64748B', fontSize: 12 }}>
                      {backgroundSyncProgress.processedConversations} conversations, {backgroundSyncProgress.processedMessages} messages
                    </Text>
                    {backgroundSyncProgress.lastRunTime && (
                      <Text style={{ color: '#64748B', fontSize: 12 }}>
                        Last: {new Date(backgroundSyncProgress.lastRunTime).toLocaleTimeString()}
                      </Text>
                    )}
                  </View>

                  {/* Status message */}
                  {backgroundSyncState && (
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 8 }}>
                      {formatBackgroundSyncStatus(backgroundSyncState)}
                    </Text>
                  )}

                  {/* Control Buttons */}
                  <View style={{ flexDirection: 'row', marginTop: 12 }}>
                    <Pressable
                      onPress={handleResumeBackgroundSyncInForeground}
                      style={({ pressed }) => ({ flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary.DEFAULT, borderRadius: 8, paddingVertical: 8, marginRight: 8, opacity: pressed ? 0.8 : 1 })}
                    >
                      <Smartphone size={14} color="#FFFFFF" />
                      <Text style={{ color: colors.text.primary, fontWeight: '500', fontSize: 14, marginLeft: 4 }}>Speed Up</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleDisableBackgroundSync}
                      style={({ pressed }) => ({ flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.danger.muted, borderRadius: 8, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}
                    >
                      <Square size={14} color="#EF4444" />
                      <Text style={{ color: colors.danger.light, fontWeight: '500', fontSize: 14, marginLeft: 4 }}>Stop</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Background Sync Complete */}
              {backgroundSyncState?.phase === 'complete' && (
                <View style={{ backgroundColor: '#22C55E10', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <CheckCircle size={16} color="#22C55E" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ color: '#4ADE80', fontWeight: '500', fontSize: 14 }}>Background sync complete!</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 2 }}>
                      {backgroundSyncState.processedMessages} messages analyzed
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleClearBackgroundSync}
                    style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.7 : 1 })}
                  >
                    <X size={16} color="#64748B" />
                  </Pressable>
                </View>
              )}

              {/* Enable Background Sync Button */}
              {!backgroundSyncState?.isEnabled && backgroundSyncState?.phase !== 'complete' && (
                <Pressable
                  onPress={handleEnableBackgroundSync}
                  disabled={!accountId || !backgroundFetchAvailable}
                  style={({ pressed }) => ({ borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: !accountId || !backgroundFetchAvailable ? '#334155' : '#A855F7', opacity: pressed ? 0.8 : 1 })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!accountId ? (
                      <>
                        <AlertCircle size={18} color="#64748B" />
                        <Text style={{ color: '#64748B', fontWeight: '600', marginLeft: 8 }}>Connect Hostaway First</Text>
                      </>
                    ) : !backgroundFetchAvailable ? (
                      <>
                        <CloudOff size={18} color="#64748B" />
                        <Text style={{ color: '#64748B', fontWeight: '600', marginLeft: 8 }}>Background Fetch Unavailable</Text>
                      </>
                    ) : (
                      <>
                        <Moon size={18} color="#FFFFFF" />
                        <Text style={{ color: colors.text.primary, fontWeight: '600', marginLeft: 8 }}>Enable Background Sync</Text>
                      </>
                    )}
                  </View>
                </Pressable>
              )}

              {/* Info about background sync */}
              <View style={{ backgroundColor: 'rgba(51,65,85,0.3)', borderRadius: 12, padding: 12, marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Clock size={14} color="#94A3B8" />
                  <Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 8, flex: 1 }}>
                    Background sync runs periodically (every 15-30 min on iOS) to fetch history in small chunks.
                    Use "Speed Up" to process faster while the app is open.
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>



          {/* Reset Button */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)} style={{ marginBottom: 32 }}>
            <Pressable
              onPress={handleResetLearning}
              style={({ pressed }) => ({ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.danger.muted, borderRadius: 16, paddingVertical: 16, opacity: pressed ? 0.8 : 1 })}
            >
              <Trash2 size={18} color="#EF4444" />
              <Text style={{ color: colors.danger.DEFAULT, fontWeight: '500', marginLeft: 8 }}>Reset All Learning Data</Text>
            </Pressable>
          </Animated.View>

          {/* Info */}
          <Animated.View
            entering={FadeInDown.delay(600).duration(400)}
            style={{ borderRadius: 12, padding: 16, marginBottom: 32, backgroundColor: 'rgba(30,41,59,0.3)' }}
          >
            <Text style={{ color: colors.text.primary, fontWeight: '500', marginBottom: 8 }}>How AI Learning Works</Text>
            <Text style={{ color: colors.text.muted, fontSize: 14, lineHeight: 20 }}>
              The AI analyzes your past messages to learn your unique communication style.
              When you approve or edit AI suggestions, it learns from those interactions to
              better match your tone, vocabulary, and preferences over time.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Date Range Modal */}
      <Modal
        visible={showDateRangeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateRangeModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}
          onPress={() => setShowDateRangeModal(false)}
        >
          <Pressable
            style={{ width: '100%', backgroundColor: colors.bg.elevated, borderRadius: 16, padding: 20 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '600' }}>Select Date Range</Text>
              <Pressable
                onPress={() => setShowDateRangeModal(false)}
                style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: colors.bg.hover, alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} color="#94A3B8" />
              </Pressable>
            </View>

            <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: 16 }}>
              Choose how far back to fetch message history for AI training.
            </Text>

            {/* Preset Options */}
            <View style={{ flexDirection: 'row', marginBottom: 16, flexWrap: 'wrap' }}>
              {['3', '6', '12', '24', 'all'].map((months) => (
                <Pressable
                  key={months}
                  onPress={() => {
                    if (months === 'all') {
                      setDateRangeMonths('120');
                      setHistoryDateRange(null, null);
                    } else {
                      setDateRangeMonths(months);
                      const start = new Date();
                      start.setMonth(start.getMonth() - parseInt(months, 10));
                      setHistoryDateRange(start, null);
                    }
                    Haptics.selectionAsync();
                  }}
                  style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, marginRight: 8, marginBottom: 8, backgroundColor: (months === 'all' && dateRangeMonths === '120') || dateRangeMonths === months ? '#14B8A6' : '#334155', opacity: pressed ? 0.7 : 1 })}
                >
                  <Text
                    style={{ fontWeight: '500', color: (months === 'all' && dateRangeMonths === '120') || dateRangeMonths === months ? '#FFFFFF' : '#CBD5E1' }}
                  >
                    {months === 'all' ? 'All Time' : `${months} months`}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Custom Input */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: 8 }}>Or enter custom months:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  value={dateRangeMonths}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, '');
                    setDateRangeMonths(num);
                    if (num) {
                      const months = parseInt(num, 10);
                      const start = new Date();
                      start.setMonth(start.getMonth() - months);
                      setHistoryDateRange(start, null);
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="12"
                  placeholderTextColor="#64748B"
                  style={{ flex: 1, backgroundColor: colors.bg.hover, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: colors.text.primary, fontSize: 16 }}
                />
                <Text style={{ color: colors.text.muted, marginLeft: 12 }}>months</Text>
              </View>
            </View>

            {/* Info */}
            <View style={{ backgroundColor: 'rgba(51,65,85,0.5)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Clock size={16} color="#94A3B8" />
                <Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 8, flex: 1 }}>
                  Fetching more history will take longer but provides better AI training data.
                  Large datasets are processed efficiently in batches.
                </Text>
              </View>
            </View>

            {/* Done Button */}
            <Pressable
              onPress={() => setShowDateRangeModal(false)}
              style={({ pressed }) => ({ backgroundColor: colors.primary.DEFAULT, borderRadius: 12, paddingVertical: 12, alignItems: 'center' as const, opacity: pressed ? 0.8 : 1 })}
            >
              <Text style={{ color: colors.text.primary, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
