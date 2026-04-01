import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/lib/store';
import type { Message, LearningEntry } from '@/lib/store';
import {
  learnFromSentMessage,
  type RegenerationOption,
} from '@/lib/ai-enhanced';
import { sendMessage as sendHostawayMessage } from '@/lib/hostaway';
import { features } from '@/lib/config';
import {
  recordDraftOutcomeViaServer,
  sendHostawayMessageViaServer,
} from '@/lib/api-client';
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
import { createCalibrationEntry, analyzeReplyDelta } from '@/lib/ai-intelligence';
import type { EnhancedAiDraft, LearningToastType } from './types';

interface UseChatMessageActionsArgs {
  conversationId: string;
  currentEnhancedDraft: EnhancedAiDraft | null;
  setCurrentEnhancedDraft: React.Dispatch<React.SetStateAction<EnhancedAiDraft | null>>;
  isGeneratingDraft: boolean;
  generateDraftForConversation: (modifier?: RegenerationOption['modifier']) => Promise<void>;
}

export function useChatMessageActions({
  conversationId,
  currentEnhancedDraft,
  setCurrentEnhancedDraft,
  isGeneratingDraft,
  generateDraftForConversation,
}: UseChatMessageActionsArgs) {
  const conversations = useAppStore((s) => s.conversations);
  const updateConversation = useAppStore((s) => s.updateConversation);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const updatePropertyKnowledge = useAppStore((s) => s.updatePropertyKnowledge);
  const incrementAnalytic = useAppStore((s) => s.incrementAnalytic);
  const addLearningEntry = useAppStore((s) => s.addLearningEntry);
  const updateAILearningProgress = useAppStore((s) => s.updateAILearningProgress);
  const aiLearningProgress = useAppStore((s) => s.aiLearningProgress);
  const addDraftOutcome = useAppStore((s) => s.addDraftOutcome);
  const addCalibrationEntry = useAppStore((s) => s.addCalibrationEntry);
  const addReplyDelta = useAppStore((s) => s.addReplyDelta);

  const [isSending, setIsSending] = useState(false);
  const [editLearningSummary, setEditLearningSummary] = useState<string | null>(null);
  const [learningToastType, setLearningToastType] = useState<LearningToastType>('edit');

  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = conversation?.messages ?? [];

  // -- Outcome tracking --
  const trackDraftOutcome = useCallback(
    (
      outcomeType: 'approved' | 'edited' | 'rejected' | 'independent',
      opts: {
        propertyId?: string;
        guestIntent?: string;
        confidence?: number;
        aiDraft?: string;
        hostReply?: string;
        guestMessage?: string;
      } = {},
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
        const delta = analyzeReplyDelta(
          opts.aiDraft,
          opts.hostReply,
          opts.guestMessage,
          opts.propertyId,
          opts.guestIntent,
        );
        addReplyDelta(delta);
        console.log(`[ChatScreen] ${outcomeType} delta:`, delta.learningSummary);
      }

      if (features.serverProxiedAI && !isDemoMode) {
        recordDraftOutcomeViaServer({
          outcomeType,
          propertyId: opts.propertyId,
          guestIntent: opts.guestIntent,
          confidence: opts.confidence,
          aiDraft: opts.aiDraft,
          hostReply: opts.hostReply,
          guestMessage: opts.guestMessage,
        }).catch((error) => {
          console.error('[ChatScreen] Failed to record server draft outcome:', error);
        });
      }
    },
    [addDraftOutcome, addCalibrationEntry, addReplyDelta],
  );

  // -- Send message (independent of draft) --
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isSending || !content.trim()) return;
      setIsSending(true);

      const lastGuestMsg = [...messages].reverse().find((m) => m.sender === 'guest');
      const aiDraftContent = currentEnhancedDraft?.content;
      const draftIntent = messages.find((m) => m.sender === 'ai_draft')?.detectedIntent;

      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        content,
        sender: 'host',
        timestamp: new Date(),
        isRead: false,
        isApproved: true,
      };
      const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
      updateConversation(conversationId, {
        messages: [...messagesWithoutDraft, newMessage],
        lastMessage: newMessage,
        hasAiDraft: false,
        aiDraftContent: undefined,
        aiDraftConfidence: undefined,
      });
      incrementAnalytic('totalMessagesHandled');
      setCurrentEnhancedDraft(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        if (!isDemoMode) {
          if (features.serverProxiedAI) {
            await sendHostawayMessageViaServer(parseInt(conversationId), content);
          } else if (accountId && apiKey) {
            await sendHostawayMessage(accountId, apiKey, parseInt(conversationId), content);
          }
        }
      } catch (error) {
        console.error('[ChatScreen] Error sending message:', error);
        Alert.alert('Send Failed', 'Message could not be delivered. It may need to be resent.');
      }

      try {
        if (aiDraftContent && lastGuestMsg) {
          const pattern = analyzeIndependentReply(
            aiDraftContent,
            content,
            lastGuestMsg.content,
            conversation?.property?.id,
            draftIntent,
          );
          storeIndependentReplyPattern(pattern).catch((err) =>
            console.error('[ChatScreen] Failed to store independent reply pattern:', err),
          );
          const summary = getIndependentReplySummary(pattern);
          setLearningToastType('independent');
          setEditLearningSummary(`${summary}`);
          setTimeout(() => setEditLearningSummary(null), 4000);
        }

        if (lastGuestMsg) {
          learnFromSentMessage(
            content,
            lastGuestMsg.content,
            conversation?.property?.id,
            false,
            true,
            'host_written',
          ).catch((err) => console.error('[ChatScreen] Incremental learning error:', err));

          updateAILearningProgress({
            realTimeIndependentRepliesCount:
              aiLearningProgress.realTimeIndependentRepliesCount + 1,
            patternsIndexed: aiLearningProgress.patternsIndexed + 1,
          });

          trackDraftOutcome('independent', {
            propertyId: conversation?.property?.id,
            guestIntent: draftIntent,
            aiDraft: currentEnhancedDraft?.content,
            hostReply: content,
            guestMessage: lastGuestMsg.content,
          });
        }
      } catch (learningErr) {
        console.error('[ChatScreen] Learning error (non-fatal):', learningErr);
      }

      setIsSending(false);
    },
    [
      messages,
      conversationId,
      updateConversation,
      isDemoMode,
      accountId,
      apiKey,
      isSending,
      currentEnhancedDraft,
      conversation,
      incrementAnalytic,
    ],
  );

  // -- Approve AI draft --
  const handleApproveAiDraft = useCallback(
    async (contentOverride?: string) => {
      if (!currentEnhancedDraft || isSending) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSending(true);

      const contentToSend = contentOverride || currentEnhancedDraft.content;
      const wasEditedByUser =
        (contentOverride != null && contentOverride !== currentEnhancedDraft.content) ||
        currentEnhancedDraft.isEdited === true;
      const lastGuestMsg = [...messages].reverse().find((m) => m.sender === 'guest');
      const draftMessage = messages.find((m) => m.sender === 'ai_draft');
      const savedDraft = { ...currentEnhancedDraft };

      const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        content: contentToSend,
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
      if (wasEditedByUser) {
        incrementAnalytic('aiResponsesEdited');
      } else {
        incrementAnalytic('aiResponsesApproved');
      }
      setCurrentEnhancedDraft(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      try {
        if (!isDemoMode) {
          if (features.serverProxiedAI) {
            await sendHostawayMessageViaServer(parseInt(conversationId), contentToSend);
          } else if (accountId && apiKey) {
            await sendHostawayMessage(
              accountId,
              apiKey,
              parseInt(conversationId),
              contentToSend,
            );
          }
        }
      } catch (error) {
        console.error('[ChatScreen] Error sending approved draft:', error);
        Alert.alert('Send Failed', 'Message could not be delivered. It may need to be resent.');
      }

      try {
        if (draftMessage) {
          const originalContent = savedDraft.originalContent || savedDraft.content;
          const learningEntry: LearningEntry = {
            id: `learn-${Date.now()}`,
            originalResponse: originalContent,
            editedResponse: wasEditedByUser ? contentToSend : undefined,
            wasApproved: true,
            wasEdited: wasEditedByUser,
            guestIntent: draftMessage.detectedIntent || 'unknown',
            propertyId: conversation?.property?.id || '',
            timestamp: new Date(),
            originType: wasEditedByUser ? 'ai_edited' : 'ai_approved',
          };
          addLearningEntry(learningEntry);

          if (wasEditedByUser && savedDraft.originalContent) {
            const editPattern = analyzeEdit(
              savedDraft.originalContent,
              contentToSend,
              conversation?.property?.id,
              draftMessage.detectedIntent,
            );
            storeEditPattern(editPattern).catch((err) =>
              console.error('[ChatScreen] Failed to store edit pattern:', err),
            );
            const summary = getEditSummary(editPattern);
            setLearningToastType('edit');
            setEditLearningSummary(summary);
            setTimeout(() => setEditLearningSummary(null), 4000);
          } else if (!wasEditedByUser) {
            setLearningToastType('approval');
            setEditLearningSummary('Response style reinforced — AI will match this tone');
            setTimeout(() => setEditLearningSummary(null), 3000);
          }

          if (lastGuestMsg) {
            learnFromSentMessage(
              contentToSend,
              lastGuestMsg.content,
              conversation?.property?.id,
              wasEditedByUser,
              true,
              wasEditedByUser ? 'ai_edited' : 'ai_approved',
            ).catch((err) => console.error('[ChatScreen] Incremental learning error:', err));

            updateAILearningProgress({
              ...(wasEditedByUser
                ? { realTimeEditsCount: aiLearningProgress.realTimeEditsCount + 1 }
                : { realTimeApprovalsCount: aiLearningProgress.realTimeApprovalsCount + 1 }),
              patternsIndexed: aiLearningProgress.patternsIndexed + 1,
            });

            trackDraftOutcome(wasEditedByUser ? 'edited' : 'approved', {
              propertyId: conversation?.property?.id,
              guestIntent: draftMessage?.detectedIntent,
              confidence: savedDraft.confidence,
              aiDraft: wasEditedByUser ? savedDraft.originalContent : undefined,
              hostReply: wasEditedByUser ? contentToSend : undefined,
              guestMessage: lastGuestMsg.content,
            });
          }
        }
      } catch (learningErr) {
        console.error('[ChatScreen] Learning error (non-fatal):', learningErr);
      }

      setIsSending(false);
    },
    [
      currentEnhancedDraft,
      messages,
      conversationId,
      updateConversation,
      isDemoMode,
      accountId,
      apiKey,
      isSending,
      conversation,
      incrementAnalytic,
    ],
  );

  // -- Regenerate --
  const handleRegenerateAiDraft = useCallback(
    async (modifier?: RegenerationOption['modifier']) => {
      if (isGeneratingDraft) return;
      incrementAnalytic('aiResponsesRejected');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
      updateConversation(conversationId, {
        messages: messagesWithoutDraft,
        hasAiDraft: false,
        aiDraftContent: undefined,
        aiDraftConfidence: undefined,
      });
      setCurrentEnhancedDraft(null);
      await generateDraftForConversation(modifier);
    },
    [
      messages,
      conversationId,
      updateConversation,
      isGeneratingDraft,
      generateDraftForConversation,
      incrementAnalytic,
    ],
  );

  // -- Edit --
  const handleEditAiDraft = useCallback((newContent: string) => {
    setCurrentEnhancedDraft((prev) =>
      prev
        ? {
            ...prev,
            content: newContent,
            isEdited: true,
            originalContent: prev.originalContent || prev.content,
          }
        : null,
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // -- Dismiss --
  const handleDismissAiDraft = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
    const lastNonDraft = messagesWithoutDraft[messagesWithoutDraft.length - 1];

    if (currentEnhancedDraft) {
      const lastGuestMsg = [...messages].reverse().find((m) => m.sender === 'guest');
      const draftMessage = messages.find((m) => m.sender === 'ai_draft');

      if (lastGuestMsg) {
        const rejectionPattern = analyzeRejection(
          currentEnhancedDraft.content,
          lastGuestMsg.content,
          conversation?.property?.id,
          draftMessage?.detectedIntent,
          currentEnhancedDraft.sentiment?.primary,
          currentEnhancedDraft.confidence,
        );

        storeRejectionPattern(rejectionPattern).catch((err) =>
          console.error('[ChatScreen] Failed to store rejection pattern:', err),
        );

        updateAILearningProgress({
          realTimeRejectionsCount: aiLearningProgress.realTimeRejectionsCount + 1,
        });

        trackDraftOutcome('rejected', {
          propertyId: conversation?.property?.id,
          guestIntent: draftMessage?.detectedIntent,
          confidence: currentEnhancedDraft?.confidence,
        });

        const summary = getRejectionSummary(rejectionPattern);
        setLearningToastType('rejection');
        setEditLearningSummary(`${summary}`);
        console.log('[ChatScreen] Rejection analysis:', summary);
        setTimeout(() => setEditLearningSummary(null), 3000);
      }
    }

    updateConversation(conversationId, {
      messages: messagesWithoutDraft,
      lastMessage: lastNonDraft,
      hasAiDraft: false,
      aiDraftContent: undefined,
      aiDraftConfidence: undefined,
    });

    setCurrentEnhancedDraft(null);
    incrementAnalytic('aiResponsesRejected');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [messages, conversationId, updateConversation, incrementAnalytic, currentEnhancedDraft, conversation]);

  // -- Fix conflict --
  const handleFixConflict = useCallback(
    (field: string, newValue: string) => {
      if (!conversation?.property?.id) return;
      const propertyId = conversation.property.id;
      const updates: Record<string, string> = { [field]: newValue };
      updatePropertyKnowledge(propertyId, updates);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (currentEnhancedDraft?.knowledgeConflicts) {
        setCurrentEnhancedDraft({
          ...currentEnhancedDraft,
          knowledgeConflicts: currentEnhancedDraft.knowledgeConflicts.filter(
            (c) => c.field !== field,
          ),
        });
      }
    },
    [conversation?.property?.id, updatePropertyKnowledge, currentEnhancedDraft],
  );

  return {
    isSending,
    editLearningSummary,
    learningToastType,
    handleSendMessage,
    handleApproveAiDraft,
    handleRegenerateAiDraft,
    handleEditAiDraft,
    handleDismissAiDraft,
    handleFixConflict,
  };
}
