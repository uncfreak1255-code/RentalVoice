/**
 * useAIDraft — Encapsulates the AI draft lifecycle.
 *
 * Extracted from ChatScreen.tsx to make each phase independently testable:
 * - Generation (demo, server-proxied, or direct AI)
 * - Approval (with edit-diff analysis and incremental learning)
 * - Editing (tracks original vs edited for delta analysis)
 * - Dismissal (rejection pattern analysis)
 * - Regeneration (with tone modifiers)
 * - Auto-send (confidence threshold gating)
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/lib/store';
import type { Message, LearningEntry } from '@/lib/store';
import {
  generateEnhancedAIResponse,
  analyzeSentimentAdvanced,
  detectTopics,
  calculateConfidence,
  getRegenerationOptions,
  type RegenerationOption,
  type EnhancedAIResponse,
  type ActionItem,
} from '@/lib/ai-enhanced';
import { generateDemoResponse } from '@/lib/ai-service';
import { sendMessage as sendHostawayMessage } from '@/lib/hostaway';
import { features } from '@/lib/config';
import {
  generateAIDraftViaServer,
  getVoiceReadinessViaServer,
  type ServerVoiceReadiness,
} from '@/lib/api-client';
import { canAutoSend } from '@/lib/managed-draft-gating';
import { aiTrainingService } from '@/lib/ai-training-service';
import { notifyAutoPilotSent } from '@/lib/push-notifications';
import {
  analyzeEdit,
  storeEditPattern,
  getEditSummary,
  analyzeRejection,
  storeRejectionPattern,
  getRejectionSummary,
  analyzeIndependentReply,
  storeIndependentReplyPattern,
  getIndependentReplySummary,
} from '@/lib/edit-diff-analysis';
import {
  createCalibrationEntry,
  analyzeReplyDelta,
} from '@/lib/ai-intelligence';

// Re-export for consumers
export interface EnhancedAiDraft {
  content: string;
  confidence: number;
  sentiment?: EnhancedAIResponse['sentiment'];
  confidenceDetails?: EnhancedAIResponse['confidence'];
  actionItems?: ActionItem[];
  regenerationOptions?: RegenerationOption[];
  topics?: EnhancedAIResponse['topics'];
  isEdited?: boolean;
  originalContent?: string;
}

export interface UseAIDraftOptions {
  conversationId: string;
  onActionItems?: (items: ActionItem[]) => void;
}

export interface UseAIDraftResult {
  draft: EnhancedAiDraft | null;
  isGenerating: boolean;
  isSending: boolean;
  learningToast: { type: 'approval' | 'edit' | 'independent' | 'rejection'; message: string } | null;
  rateLimitError: string | null;

  // Actions
  generateDraft: (modifier?: RegenerationOption['modifier']) => Promise<void>;
  approveDraft: () => Promise<void>;
  editDraft: (newContent: string) => void;
  dismissDraft: () => void;
  regenerateDraft: (modifier?: RegenerationOption['modifier']) => Promise<void>;
  sendIndependentMessage: (content: string) => Promise<void>;
  clearDraft: () => void;
  preloadDraft: (content: string, confidence: number) => void;
  clearRateLimitError: () => void;
}

export function useAIDraft({ conversationId, onActionItems }: UseAIDraftOptions): UseAIDraftResult {
  const [draft, setDraft] = useState<EnhancedAiDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [learningToast, setLearningToast] = useState<UseAIDraftResult['learningToast']>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  // Zustand selectors
  const conversations = useAppStore((s) => s.conversations);
  const addMessage = useAppStore((s) => s.addMessage);
  const updateConversation = useAppStore((s) => s.updateConversation);
  const autoPilotEnabled = useAppStore((s) => s.settings.autoPilotEnabled);
  const autoPilotThreshold = useAppStore((s) => s.settings.autoPilotConfidenceThreshold);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);
  const hostName = useAppStore((s) => s.settings.hostName);
  const incrementAnalytic = useAppStore((s) => s.incrementAnalytic);
  const addLearningEntry = useAppStore((s) => s.addLearningEntry);
  const hostStyleProfiles = useAppStore((s) => s.hostStyleProfiles);
  const addAutoPilotLog = useAppStore((s) => s.addAutoPilotLog);
  const notificationSettings = useAppStore((s) => s.settings);
  const responseLanguageMode = useAppStore((s) => s.settings.responseLanguageMode ?? 'match_guest');
  const defaultLanguage = useAppStore((s) => s.settings.defaultLanguage ?? 'en');
  const updateAILearningProgress = useAppStore((s) => s.updateAILearningProgress);
  const aiLearningProgress = useAppStore((s) => s.aiLearningProgress);
  const addDraftOutcome = useAppStore((s) => s.addDraftOutcome);
  const addCalibrationEntry = useAppStore((s) => s.addCalibrationEntry);
  const addReplyDelta = useAppStore((s) => s.addReplyDelta);
  const voiceReadiness = useAppStore((s) => s.voiceReadiness);
  const setVoiceReadiness = useAppStore((s) => s.setVoiceReadiness);

  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = conversation?.messages ?? [];
  const currentPropertyKnowledge = conversation?.property?.id
    ? propertyKnowledge[conversation.property.id]
    : undefined;
  const currentHostStyleProfile =
    hostStyleProfiles[conversation?.property?.id || ''] || hostStyleProfiles['global'];

  // ── Helpers ────────────────────────────────────────────

  const showToast = useCallback((type: NonNullable<UseAIDraftResult['learningToast']>['type'], message: string, duration = 3000) => {
    setLearningToast({ type, message });
    setTimeout(() => setLearningToast(null), duration);
  }, []);

  const trackOutcome = useCallback((
    outcomeType: 'approved' | 'edited' | 'rejected' | 'independent',
    opts: { propertyId?: string; guestIntent?: string; confidence?: number; aiDraft?: string; hostReply?: string; guestMessage?: string } = {}
  ) => {
    const outcome = {
      id: `outcome_${Date.now()}`,
      timestamp: new Date(),
      outcomeType,
      propertyId: opts.propertyId,
      guestIntent: opts.guestIntent,
      confidence: opts.confidence,
    };
    addDraftOutcome(outcome);

    if (opts.confidence !== undefined) {
      addCalibrationEntry(createCalibrationEntry(outcome));
    }

    if (opts.aiDraft && opts.hostReply && opts.guestMessage) {
      const delta = analyzeReplyDelta(opts.aiDraft, opts.hostReply, opts.guestMessage, opts.propertyId, opts.guestIntent);
      addReplyDelta(delta);
    }
  }, [addDraftOutcome, addCalibrationEntry, addReplyDelta]);

  const clearConversationDraft = useCallback(() => {
    const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
    const lastNonDraft = messagesWithoutDraft[messagesWithoutDraft.length - 1];
    updateConversation(conversationId, {
      messages: messagesWithoutDraft,
      lastMessage: lastNonDraft,
      hasAiDraft: false,
      aiDraftContent: undefined,
      aiDraftConfidence: undefined,
    });
  }, [messages, conversationId, updateConversation]);

  // ── Actions ────────────────────────────────────────────

  const preloadDraft = useCallback((content: string, confidence: number) => {
    setDraft({ content, confidence });
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const refreshVoiceReadiness = useCallback(async (): Promise<ServerVoiceReadiness | null> => {
    if (!features.serverProxiedAI || !conversation?.property?.id) {
      return null;
    }

    try {
      const readiness = await getVoiceReadinessViaServer(conversation.property.id);
      setVoiceReadiness({
        ...readiness,
        updatedAt: new Date().toISOString(),
      });
      return readiness;
    } catch (readinessError) {
      console.warn('[useAIDraft] Failed to fetch voice readiness:', readinessError);
      return null;
    }
  }, [conversation?.property?.id, setVoiceReadiness]);

  const generateDraft = useCallback(async (modifier?: RegenerationOption['modifier']) => {
    if (!conversation || isGenerating) return;

    // ── RESPONSE-NEEDED GATE ──
    // Don't draft for closing/acknowledgment messages — a real host wouldn't reply to "Ok, thank you"
    const CLOSING_PATTERNS = /^\s*(ok|okay|k|got it|thanks?|thank you|thank you!|thx|ty|perfect|great|sounds good|awesome|understood|will do|no worries|all good|all set|cool|sure|noted|appreciate it|much appreciated|you're the best|wonderful|excellent|👍|🙏|❤️|😊|🙌|👌)\s*[.!]*\s*$/i;
    const nonDraftMessages = conversation.messages.filter(m => m.sender !== 'ai_draft');
    const lastMsg = nonDraftMessages[nonDraftMessages.length - 1];
    const secondLastMsg = nonDraftMessages[nonDraftMessages.length - 2];

    if (
      lastMsg?.sender === 'guest' &&
      secondLastMsg?.sender === 'host' &&
      CLOSING_PATTERNS.test(lastMsg.content.trim()) &&
      lastMsg.content.trim().length < 50  // Short messages only
    ) {
      console.log('[useAIDraft] ⏭️ Skipping draft — guest sent closing message:', lastMsg.content.trim());
      setDraft({
        content: "You're welcome! 😊",
        confidence: 95,
      });
      return;
    }

    setIsGenerating(true);

    try {
      let enhancedResponse: EnhancedAIResponse | null = null;
      let latestVoiceReadiness: ServerVoiceReadiness | null = null;

      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const demoResponse = generateDemoResponse(conversation);
        const lastGuestMessage = [...conversation.messages].reverse().find((m) => m.sender === 'guest');
        const sentiment = lastGuestMessage
          ? analyzeSentimentAdvanced(lastGuestMessage.content)
          : { primary: 'neutral' as const, intensity: 50, emotions: [], requiresEscalation: false };
        const topics = lastGuestMessage
          ? detectTopics(lastGuestMessage.content, currentPropertyKnowledge)
          : [];
        const confidence = calculateConfidence(sentiment, topics, currentPropertyKnowledge, currentHostStyleProfile);

        enhancedResponse = {
          content: demoResponse.content,
          sentiment,
          topics,
          confidence,
          actionItems: [],
          knowledgeConflicts: [],
          detectedLanguage: 'en',
          regenerationOptions: getRegenerationOptions(sentiment),
        };
      } else if (features.serverProxiedAI) {
        latestVoiceReadiness = await refreshVoiceReadiness();
        const lastGuest = [...conversation.messages].reverse().find((m) => m.sender === 'guest');
        const serverResponse = await generateAIDraftViaServer({
          message: lastGuest?.content || '',
          conversationHistory: conversation.messages.map(m => ({
            role: m.sender === 'host' ? 'assistant' : 'user',
            content: m.content,
          })),
          propertyId: conversation.property?.id,
          guestName: conversation.guest?.name,
          responseLanguageMode,
          hostDefaultLanguage: defaultLanguage,
        });

        enhancedResponse = {
          content: serverResponse.draft,
          sentiment: { primary: 'neutral' as const, intensity: 50, emotions: [], requiresEscalation: false },
          topics: [],
          confidence: {
            overall: serverResponse.confidence,
            factors: { sentimentMatch: 80, knowledgeAvailable: 80, topicCoverage: 80, styleMatch: 80, safetyCheck: 100 },
            warnings: [],
            blockedForAutoSend: false,
          },
          actionItems: [],
          knowledgeConflicts: [],
          detectedLanguage: serverResponse.detectedLanguage,
          regenerationOptions: [],
        };
      } else {
        enhancedResponse = await generateEnhancedAIResponse({
          conversation,
          propertyKnowledge: currentPropertyKnowledge,
          hostName,
          hostStyleProfile: currentHostStyleProfile,
          regenerationModifier: modifier,
          responseLanguageMode,
          hostDefaultLanguage: defaultLanguage,
        });
      }

      setDraft({
        content: enhancedResponse.content,
        confidence: enhancedResponse.confidence.overall,
        sentiment: enhancedResponse.sentiment,
        confidenceDetails: enhancedResponse.confidence,
        actionItems: enhancedResponse.actionItems,
        regenerationOptions: enhancedResponse.regenerationOptions,
        topics: enhancedResponse.topics,
      });

      if (enhancedResponse.actionItems.length > 0) {
        onActionItems?.(enhancedResponse.actionItems);
      }

      const newDraftMsg: Message = {
        id: `draft-${Date.now()}`,
        conversationId,
        content: enhancedResponse.content,
        sender: 'ai_draft',
        timestamp: new Date(),
        isRead: true,
        aiConfidence: enhancedResponse.confidence.overall,
        detectedIntent: enhancedResponse.topics[0]?.intent || 'general_inquiry',
        sentiment: enhancedResponse.sentiment.primary,
      };

      addMessage(conversationId, newDraftMsg);
      updateConversation(conversationId, {
        hasAiDraft: true,
        aiDraftSentAt: new Date(),
        aiDraftContent: enhancedResponse.content,
        aiDraftConfidence: enhancedResponse.confidence.overall,
      });

      // Auto-send check — SAFETY GUARDS:
      // 1. Never auto-send in demo mode (demo confidence is not real)
      // 2. In managed mode, trust the server readiness contract instead of local style samples
      // 3. In personal mode, never auto-send if style profile has < 10 samples
      // 3. Never auto-send if confidence scoring explicitly blocked it
      const hasAdequateStyleProfile = currentHostStyleProfile && currentHostStyleProfile.samplesAnalyzed >= 10;
      const managedAutoSendReady = features.serverProxiedAI
        ? canAutoSend(latestVoiceReadiness ?? voiceReadiness)
        : hasAdequateStyleProfile;
      const shouldAutoSend = autoPilotEnabled
        && !isDemoMode
        && managedAutoSendReady
        && enhancedResponse.confidence.overall >= autoPilotThreshold
        && !enhancedResponse.confidence.blockedForAutoSend;

      if (shouldAutoSend) {
        await handleAutoSend(enhancedResponse.content);
      } else if (
        autoPilotEnabled &&
        (enhancedResponse.confidence.blockedForAutoSend || isDemoMode || (features.serverProxiedAI && !managedAutoSendReady))
      ) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.startsWith('RATE_LIMIT:')) {
        const reason = errMsg.replace('RATE_LIMIT: ', '');
        setRateLimitError(reason);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => setRateLimitError(null), 8000);
      }
      console.error('[useAIDraft] Error generating draft:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [conversation, isGenerating, isDemoMode, currentPropertyKnowledge, hostName, autoPilotEnabled, autoPilotThreshold, currentHostStyleProfile, onActionItems, refreshVoiceReadiness, voiceReadiness]);

  const handleAutoSend = async (content: string) => {
    if (!conversation || !accountId || !apiKey) return;

    try {
      if (!isDemoMode) {
        await sendHostawayMessage(accountId, apiKey, parseInt(conversationId), content);
      }

      const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        content,
        sender: 'host',
        timestamp: new Date(),
        isRead: false,
        isApproved: true,
      };

      updateConversation(conversationId, {
        messages: [...messagesWithoutDraft, newMessage],
        lastMessage: newMessage,
        hasAiDraft: false,
        aiDraftContent: undefined,
        aiDraftConfidence: undefined,
      });

      setDraft(null);
      incrementAnalytic('totalMessagesHandled');
      incrementAnalytic('aiResponsesApproved');

      const guestName = conversation.guest?.name || 'Guest';
      const confidence = draft?.confidence ?? autoPilotThreshold;
      notifyAutoPilotSent(guestName, confidence, {
        quietHoursStart: notificationSettings.autoPilotScheduleStart,
        quietHoursEnd: notificationSettings.autoPilotScheduleEnd,
      }).catch(err => console.error('[useAIDraft] Push notification error:', err));

      addAutoPilotLog({
        id: `ap-${Date.now()}`,
        timestamp: new Date(),
        conversationId,
        guestName,
        action: 'auto_sent',
        reason: `Confidence ${confidence}% met threshold ${autoPilotThreshold}%`,
        confidence,
        messagePreview: content.substring(0, 100),
        propertyId: conversation.property?.id || '',
        propertyName: conversation.property?.name || '',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[useAIDraft] Auto-send failed:', error);
    }
  };

  const approveDraft = useCallback(async () => {
    if (!draft || isSending) return;
    setIsSending(true);

    try {
      if (!isDemoMode && accountId && apiKey) {
        await sendHostawayMessage(accountId, apiKey, parseInt(conversationId), draft.content);
      }

      const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        content: draft.content,
        sender: 'host',
        timestamp: new Date(),
        isRead: false,
        isApproved: true,
      };

      updateConversation(conversationId, {
        messages: [...messagesWithoutDraft, newMessage],
        lastMessage: newMessage,
        hasAiDraft: false,
        aiDraftContent: undefined,
        aiDraftConfidence: undefined,
      });

      incrementAnalytic('totalMessagesHandled');

      const wasEdited = draft.isEdited === true;
      incrementAnalytic(wasEdited ? 'aiResponsesEdited' : 'aiResponsesApproved');

      const lastGuestMessage = [...messages].reverse().find(m => m.sender === 'guest');
      const draftMessage = messages.find((m) => m.sender === 'ai_draft');

      if (draftMessage) {
        const originalContent = draft.originalContent || draft.content;
        const learningEntry: LearningEntry = {
          id: `learn-${Date.now()}`,
          originalResponse: originalContent,
          editedResponse: wasEdited ? draft.content : undefined,
          wasApproved: true,
          wasEdited,
          guestIntent: draftMessage.detectedIntent || 'unknown',
          propertyId: conversation?.property?.id || '',
          timestamp: new Date(),
        };
        addLearningEntry(learningEntry);

        if (wasEdited && draft.originalContent) {
          const editPattern = analyzeEdit(draft.originalContent, draft.content, conversation?.property?.id, draftMessage.detectedIntent);
          storeEditPattern(editPattern).catch(console.error);
          showToast('edit', getEditSummary(editPattern), 4000);
        } else if (!wasEdited) {
          showToast('approval', 'Response style reinforced — AI will match this tone');
        }

        if (lastGuestMessage) {
          aiTrainingService.learnFromReply(lastGuestMessage.content, draft.content, wasEdited, conversation?.property?.id, wasEdited ? 'ai_edited' : 'ai_approved').catch(console.error);
          updateAILearningProgress({
            ...(wasEdited
              ? { realTimeEditsCount: aiLearningProgress.realTimeEditsCount + 1 }
              : { realTimeApprovalsCount: aiLearningProgress.realTimeApprovalsCount + 1 }),
            patternsIndexed: aiLearningProgress.patternsIndexed + 1,
          });

          trackOutcome(wasEdited ? 'edited' : 'approved', {
            propertyId: conversation?.property?.id,
            guestIntent: draftMessage?.detectedIntent,
            confidence: draft.confidence,
            aiDraft: wasEdited ? draft.originalContent : undefined,
            hostReply: wasEdited ? draft.content : undefined,
            guestMessage: lastGuestMessage.content,
          });
        }
      }

      setDraft(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[useAIDraft] Error approving draft:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [draft, messages, conversationId, updateConversation, isDemoMode, accountId, apiKey, isSending, conversation]);

  const editDraft = useCallback((newContent: string) => {
    setDraft(prev => prev ? {
      ...prev,
      content: newContent,
      isEdited: true,
      originalContent: prev.originalContent || prev.content,
    } : null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const dismissDraft = useCallback(() => {
    if (draft) {
      const lastGuestMessage = [...messages].reverse().find(m => m.sender === 'guest');
      const draftMessage = messages.find(m => m.sender === 'ai_draft');

      if (lastGuestMessage) {
        const rejectionPattern = analyzeRejection(
          draft.content,
          lastGuestMessage.content,
          conversation?.property?.id,
          draftMessage?.detectedIntent,
          draft.sentiment?.primary,
          draft.confidence
        );
        storeRejectionPattern(rejectionPattern).catch(console.error);
        updateAILearningProgress({ realTimeRejectionsCount: aiLearningProgress.realTimeRejectionsCount + 1 });
        trackOutcome('rejected', {
          propertyId: conversation?.property?.id,
          guestIntent: draftMessage?.detectedIntent,
          confidence: draft.confidence,
        });
        showToast('rejection', getRejectionSummary(rejectionPattern));
      }
    }

    clearConversationDraft();
    setDraft(null);
    incrementAnalytic('aiResponsesRejected');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [draft, messages, conversationId, conversation, clearConversationDraft, incrementAnalytic, trackOutcome, showToast]);

  const regenerateDraft = useCallback(async (modifier?: RegenerationOption['modifier']) => {
    if (isGenerating) return;
    incrementAnalytic('aiResponsesRejected');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Clear current draft first
    clearConversationDraft();
    setDraft(null);

    // Wait for next tick to let Zustand state settle before regenerating
    await new Promise(resolve => setTimeout(resolve, 50));

    // Regenerate with modifier
    await generateDraft(modifier);
  }, [isGenerating, clearConversationDraft, generateDraft, incrementAnalytic]);

  const sendIndependentMessage = useCallback(async (content: string) => {
    if (isSending || !content.trim()) return;
    setIsSending(true);

    try {
      const lastGuestMessage = [...messages].reverse().find(m => m.sender === 'guest');
      const draftIntent = messages.find(m => m.sender === 'ai_draft')?.detectedIntent;

      if (draft?.content && lastGuestMessage) {
        const pattern = analyzeIndependentReply(draft.content, content, lastGuestMessage.content, conversation?.property?.id, draftIntent);
        storeIndependentReplyPattern(pattern).catch(console.error);
        showToast('independent', getIndependentReplySummary(pattern), 4000);
      }

      if (lastGuestMessage) {
        aiTrainingService.learnFromReply(lastGuestMessage.content, content, true, conversation?.property?.id, 'host_written').catch(console.error);
        updateAILearningProgress({
          realTimeIndependentRepliesCount: aiLearningProgress.realTimeIndependentRepliesCount + 1,
          patternsIndexed: aiLearningProgress.patternsIndexed + 1,
        });
        trackOutcome('independent', {
          propertyId: conversation?.property?.id,
          guestIntent: draftIntent,
          aiDraft: draft?.content,
          hostReply: content,
          guestMessage: lastGuestMessage.content,
        });
      }

      if (!isDemoMode && accountId && apiKey) {
        await sendHostawayMessage(accountId, apiKey, parseInt(conversationId), content);
      }

      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        content,
        sender: 'host',
        timestamp: new Date(),
        isRead: false,
        isApproved: true,
      };

      const messagesWithoutDraft = messages.filter(m => m.sender !== 'ai_draft');
      updateConversation(conversationId, {
        messages: [...messagesWithoutDraft, newMessage],
        lastMessage: newMessage,
        hasAiDraft: false,
        aiDraftContent: undefined,
        aiDraftConfidence: undefined,
      });

      addMessage(conversationId, newMessage);
      incrementAnalytic('totalMessagesHandled');
      setDraft(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('[useAIDraft] Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [messages, conversationId, updateConversation, addMessage, isDemoMode, accountId, apiKey, isSending, draft, conversation]);

  return {
    draft,
    isGenerating,
    isSending,
    learningToast,
    rateLimitError,
    generateDraft,
    approveDraft,
    editDraft,
    dismissDraft,
    regenerateDraft,
    sendIndependentMessage,
    clearDraft,
    preloadDraft,
    clearRateLimitError: () => setRateLimitError(null),
  };
}
