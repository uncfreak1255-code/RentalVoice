import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/lib/store';
import type { Message } from '@/lib/store';
import { sendMessage as sendHostawayMessage } from '@/lib/hostaway';
import { features } from '@/lib/config';
import { sendHostawayMessageViaServer } from '@/lib/api-client';
import { notifyAutoPilotSent } from '@/lib/push-notifications';
import type { EnhancedAiDraft } from './types';

interface UseAutoSendArgs {
  conversationId: string;
  currentEnhancedDraft: EnhancedAiDraft | null;
  setCurrentEnhancedDraft: React.Dispatch<React.SetStateAction<EnhancedAiDraft | null>>;
}

export function useAutoSend({
  conversationId,
  currentEnhancedDraft,
  setCurrentEnhancedDraft,
}: UseAutoSendArgs) {
  const conversations = useAppStore((s) => s.conversations);
  const updateConversation = useAppStore((s) => s.updateConversation);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const incrementAnalytic = useAppStore((s) => s.incrementAnalytic);
  const addAutoPilotLog = useAppStore((s) => s.addAutoPilotLog);
  const notificationSettings = useAppStore((s) => s.settings);
  const autoPilotThreshold = useAppStore((s) => s.settings.autoPilotConfidenceThreshold);

  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = conversation?.messages ?? [];

  const handleAutoSend = useCallback(
    async (content: string) => {
      if (!conversation) return;
      if (!isDemoMode && !features.serverProxiedAI && (!accountId || !apiKey)) return;

      try {
        if (!isDemoMode) {
          if (features.serverProxiedAI) {
            await sendHostawayMessageViaServer(parseInt(conversationId), content);
          } else {
            await sendHostawayMessage(accountId!, apiKey!, parseInt(conversationId), content);
          }
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

        setCurrentEnhancedDraft(null);
        incrementAnalytic('totalMessagesHandled');
        incrementAnalytic('aiResponsesApproved');

        const guestName = conversation.guest?.name || 'Guest';
        const confidence = currentEnhancedDraft?.confidence ?? autoPilotThreshold;
        notifyAutoPilotSent(guestName, confidence, {
          quietHoursStart: notificationSettings.autoPilotScheduleStart,
          quietHoursEnd: notificationSettings.autoPilotScheduleEnd,
        }).catch((err) => console.error('[ChatScreen] Push notification error:', err));

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
        console.error('[ChatScreen] Auto-send failed:', error);
      }
    },
    [
      conversation,
      isDemoMode,
      accountId,
      apiKey,
      conversationId,
      messages,
      updateConversation,
      incrementAnalytic,
      currentEnhancedDraft,
      autoPilotThreshold,
      notificationSettings,
      addAutoPilotLog,
    ],
  );

  return handleAutoSend;
}
