import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/lib/store';
import type { Message } from '@/lib/store';
import { generateDemoResponse } from '@/lib/ai-service';
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
import { features } from '@/lib/config';
import {
  generateAIDraftViaServer,
  getVoiceReadinessViaServer,
  getCurrentEntitlements,
  type ServerVoiceReadiness,
} from '@/lib/api-client';
import type { EnhancedAiDraft } from './types';
import { useChatMessageActions } from './useChatMessageActions';
import { useAutoSend } from './useAutoSend';

interface UseChatDraftEngineArgs {
  conversationId: string;
  onOpenUpsells?: () => void;
}

export function useChatDraftEngine({ conversationId, onOpenUpsells }: UseChatDraftEngineArgs) {
  const conversations = useAppStore((s) => s.conversations);
  const addMessage = useAppStore((s) => s.addMessage);
  const updateConversation = useAppStore((s) => s.updateConversation);
  const autoPilotEnabled = useAppStore((s) => s.settings.autoPilotEnabled);
  const autoPilotThreshold = useAppStore((s) => s.settings.autoPilotConfidenceThreshold);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);
  const hostName = useAppStore((s) => s.settings.hostName);
  const incrementAnalytic = useAppStore((s) => s.incrementAnalytic);
  const hostStyleProfiles = useAppStore((s) => s.hostStyleProfiles);
  const addIssue = useAppStore((s) => s.addIssue);
  const responseLanguageMode = useAppStore((s) => s.settings.responseLanguageMode ?? 'match_guest');
  const defaultLanguage = useAppStore((s) => s.settings.defaultLanguage ?? 'en');
  const voiceReadiness = useAppStore((s) => s.voiceReadiness);
  const setVoiceReadiness = useAppStore((s) => s.setVoiceReadiness);

  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [rateLimitActionLabel, setRateLimitActionLabel] = useState<string | null>(null);
  const [currentEnhancedDraft, setCurrentEnhancedDraft] = useState<EnhancedAiDraft | null>(null);
  const [, setCurrentModifier] = useState<RegenerationOption['modifier'] | undefined>();

  const lastGeneratedForMessageId = useRef<string | null>(null);

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId],
  );

  const messages = conversation?.messages ?? [];

  const currentPropertyKnowledge = conversation?.property?.id
    ? propertyKnowledge[conversation.property.id]
    : undefined;

  const currentHostStyleProfile = useMemo(() => {
    if (!conversation?.property?.id) return hostStyleProfiles['global'];
    return hostStyleProfiles[conversation.property.id] || hostStyleProfiles['global'];
  }, [conversation?.property?.id, hostStyleProfiles]);

  // -- Composer notice helpers --
  const dismissComposerNotice = useCallback(() => {
    setRateLimitError(null);
    setRateLimitActionLabel(null);
  }, []);

  const showComposerNotice = useCallback((message: string, actionLabel: string | null = null) => {
    setRateLimitError(message);
    setRateLimitActionLabel(actionLabel);
    setTimeout(() => {
      setRateLimitError((current) => {
        if (current === message) {
          setRateLimitActionLabel(null);
          return null;
        }
        return current;
      });
    }, 8000);
  }, []);

  // -- Voice readiness --
  const refreshVoiceReadiness = useCallback(async () => {
    if (!features.serverProxiedAI || !conversation?.property?.id) return null;
    try {
      const readiness = await getVoiceReadinessViaServer(conversation.property.id);
      setVoiceReadiness({ ...readiness, updatedAt: new Date().toISOString() });
      return readiness;
    } catch (readinessError) {
      console.warn('[ChatScreen] Failed to fetch voice readiness:', readinessError);
      return null;
    }
  }, [conversation?.property?.id, setVoiceReadiness]);

  // -- Action items handler --
  const handleActionItems = useCallback(
    (actionItems: ActionItem[]) => {
      if (!conversation) return;
      for (const item of actionItems) {
        if (item.type === 'maintenance') {
          addIssue({
            id: item.id,
            conversationId: item.conversationId,
            category: 'maintenance',
            description: item.description,
            status: 'open',
            priority: item.priority,
            createdAt: item.createdAt,
          });
        }
      }
    },
    [conversation, addIssue],
  );

  // -- Auto-send (extracted hook) --
  const handleAutoSend = useAutoSend({
    conversationId,
    currentEnhancedDraft,
    setCurrentEnhancedDraft,
  });

  // -- Generate draft --
  const generateDraftForConversation = useCallback(
    async (modifier?: RegenerationOption['modifier']) => {
      if (!conversation || isGeneratingDraft) return;

      setIsGeneratingDraft(true);
      setCurrentModifier(modifier);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        let enhancedResponse: EnhancedAIResponse | null = null;
        let latestVoiceReadiness: ServerVoiceReadiness | null = null;

        if (isDemoMode) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const demoResponse = generateDemoResponse(conversation);
          const lastGuest = [...conversation.messages]
            .reverse()
            .find((m) => m.sender === 'guest');
          const sentiment = lastGuest
            ? analyzeSentimentAdvanced(lastGuest.content)
            : {
                primary: 'neutral' as const,
                intensity: 50,
                emotions: [],
                requiresEscalation: false,
              };
          const topics = lastGuest
            ? detectTopics(lastGuest.content, currentPropertyKnowledge)
            : [];
          const confidence = calculateConfidence(
            sentiment,
            topics,
            currentPropertyKnowledge,
            currentHostStyleProfile,
          );

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
          let supermemoryMode: 'off' | 'full' | 'degraded' = 'full';
          try {
            const entitlementState = await getCurrentEntitlements();
            supermemoryMode = entitlementState.entitlements.supermemoryMode;
          } catch (entitlementsError) {
            console.warn(
              '[ChatScreen] Failed to fetch entitlements before draft generation:',
              entitlementsError,
            );
          }

          if (supermemoryMode === 'degraded') {
            showComposerNotice(
              'Memory limit reached for this month. Drafting continues with reduced personalization.',
              onOpenUpsells ? 'Upgrade' : null,
            );
          } else if (supermemoryMode === 'off') {
            showComposerNotice(
              'Advanced memory is unavailable on your current plan. Drafting continues without memory context.',
              onOpenUpsells ? 'Upgrade' : null,
            );
          }

          const lastGuest = [...conversation.messages]
            .reverse()
            .find((m) => m.sender === 'guest');
          const serverResponse = await generateAIDraftViaServer({
            message: lastGuest?.content || '',
            conversationHistory: conversation.messages.map((m) => ({
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
            sentiment: {
              primary: 'neutral' as const,
              intensity: 50,
              emotions: [],
              requiresEscalation: false,
            },
            topics: [],
            confidence: {
              overall: serverResponse.confidence,
              factors: {
                sentimentMatch: 80,
                knowledgeAvailable: 80,
                topicCoverage: 80,
                styleMatch: 80,
                safetyCheck: 100,
              },
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

        console.log('[ChatScreen] Setting enhanced draft:', {
          content: enhancedResponse.content.substring(0, 50),
          confidence: enhancedResponse.confidence.overall,
          autoPilotEnabled,
        });

        setCurrentEnhancedDraft({
          content: enhancedResponse.content,
          confidence: enhancedResponse.confidence.overall,
          sentiment: enhancedResponse.sentiment,
          confidenceDetails: enhancedResponse.confidence,
          actionItems: enhancedResponse.actionItems,
          regenerationOptions: enhancedResponse.regenerationOptions,
          topics: enhancedResponse.topics,
          historicalMatches: enhancedResponse.historicalMatches,
          knowledgeConflicts: enhancedResponse.knowledgeConflicts,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (enhancedResponse.actionItems.length > 0) {
          handleActionItems(enhancedResponse.actionItems);
        }

        const newDraft: Message = {
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

        addMessage(conversationId, newDraft);
        updateConversation(conversationId, {
          hasAiDraft: true,
          aiDraftSentAt: new Date(),
          aiDraftContent: enhancedResponse.content,
          aiDraftConfidence: enhancedResponse.confidence.overall,
        });

        const managedAutoSendReady = features.serverProxiedAI
          ? (latestVoiceReadiness?.autopilotEligible ?? voiceReadiness.autopilotEligible)
          : true;
        if (
          autoPilotEnabled &&
          managedAutoSendReady &&
          enhancedResponse.confidence.overall >= autoPilotThreshold &&
          !enhancedResponse.confidence.blockedForAutoSend
        ) {
          console.log('[ChatScreen] Auto-pilot: Confidence meets threshold, auto-sending...');
          await handleAutoSend(enhancedResponse.content);
        } else if (
          autoPilotEnabled &&
          (enhancedResponse.confidence.blockedForAutoSend ||
            (features.serverProxiedAI && !managedAutoSendReady))
        ) {
          if (features.serverProxiedAI && !managedAutoSendReady) {
            showComposerNotice(
              latestVoiceReadiness?.reason ||
                voiceReadiness.reason ||
                'Autopilot stays off until your voice model is ready.',
              null,
            );
          } else {
            console.log(
              '[ChatScreen] Auto-pilot: Blocked for review -',
              enhancedResponse.confidence.blockReason,
            );
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.startsWith('RATE_LIMIT:')) {
          const reason = errMsg.replace('RATE_LIMIT: ', '');
          showComposerNotice(reason, null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        console.error('[ChatScreen] Error generating AI draft:', error);
      } finally {
        setIsGeneratingDraft(false);
        setCurrentModifier(undefined);
      }
    },
    [
      conversation,
      isGeneratingDraft,
      isDemoMode,
      currentPropertyKnowledge,
      hostName,
      autoPilotEnabled,
      autoPilotThreshold,
      currentHostStyleProfile,
      handleActionItems,
      showComposerNotice,
      onOpenUpsells,
      refreshVoiceReadiness,
      voiceReadiness,
      handleAutoSend,
      addMessage,
      updateConversation,
      conversationId,
      responseLanguageMode,
      defaultLanguage,
    ],
  );

  // -- Auto-generate draft when new guest message arrives --
  useEffect(() => {
    if (!conversation) return;

    const lastMessage = messages[messages.length - 1];
    const existingDraft = messages.find((m) => m.sender === 'ai_draft');

    console.log('[ChatScreen] Checking for AI draft generation:', {
      lastMessageSender: lastMessage?.sender,
      lastMessageContent: lastMessage?.content?.substring(0, 50),
      hasAiDraft: conversation.hasAiDraft,
      existingDraftInMessages: !!existingDraft,
      currentEnhancedDraft: !!currentEnhancedDraft,
      aiDraftContent: !!conversation.aiDraftContent,
      autoPilotEnabled,
    });

    if (
      conversation.hasAiDraft &&
      conversation.aiDraftContent &&
      !currentEnhancedDraft &&
      !isGeneratingDraft
    ) {
      console.log('[ChatScreen] Pre-loading AI draft from conversation storage...');
      setCurrentEnhancedDraft({
        content: conversation.aiDraftContent,
        confidence: conversation.aiDraftConfidence || 75,
      });
      return;
    }

    if (
      conversation.hasAiDraft &&
      !conversation.aiDraftContent &&
      existingDraft &&
      !currentEnhancedDraft &&
      !isGeneratingDraft
    ) {
      console.log('[ChatScreen] Restoring draft from messages...');
      setCurrentEnhancedDraft({
        content: existingDraft.content,
        confidence: existingDraft.aiConfidence || 75,
      });
      return;
    }

    if (
      conversation.hasAiDraft &&
      !existingDraft &&
      !currentEnhancedDraft &&
      !conversation.aiDraftContent
    ) {
      console.log('[ChatScreen] Resetting stale hasAiDraft flag...');
      updateConversation(conversationId, { hasAiDraft: false });
      return;
    }

    if (lastMessage?.sender === 'guest' && !conversation.hasAiDraft && !isGeneratingDraft) {
      if (lastGeneratedForMessageId.current === lastMessage.id) {
        console.log('[ChatScreen] Already generated draft for this message, skipping...');
        return;
      }
      console.log('[ChatScreen] Triggering AI draft generation...');
      lastGeneratedForMessageId.current = lastMessage.id;
      generateDraftForConversation();
    }
  }, [
    messages.length,
    conversation?.hasAiDraft,
    conversation?.aiDraftContent,
    currentEnhancedDraft,
    isGeneratingDraft,
  ]);

  // -- Message actions (send, approve, edit, dismiss, fix conflict) --
  const messageActions = useChatMessageActions({
    conversationId,
    currentEnhancedDraft,
    setCurrentEnhancedDraft,
    isGeneratingDraft,
    generateDraftForConversation,
  });

  return {
    // State
    currentEnhancedDraft,
    isGeneratingDraft,
    isSending: messageActions.isSending,
    rateLimitError,
    rateLimitActionLabel,
    editLearningSummary: messageActions.editLearningSummary,
    learningToastType: messageActions.learningToastType,

    // Actions
    handleSendMessage: messageActions.handleSendMessage,
    handleApproveAiDraft: messageActions.handleApproveAiDraft,
    handleRegenerateAiDraft: messageActions.handleRegenerateAiDraft,
    handleEditAiDraft: messageActions.handleEditAiDraft,
    handleDismissAiDraft: messageActions.handleDismissAiDraft,
    handleFixConflict: messageActions.handleFixConflict,
    dismissComposerNotice,
  };
}
