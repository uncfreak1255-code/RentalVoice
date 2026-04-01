import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useAppStore } from '@/lib/store';
import { triageIssueFromMessage } from '@/lib/issue-triage';
import { buildIssueHandoffDraft } from '@/lib/issue-triage';
import type { EnhancedAiDraft } from './types';

interface UseChatIssuesArgs {
  conversationId: string;
  currentEnhancedDraft: EnhancedAiDraft | null;
}

export function useChatIssues({ conversationId, currentEnhancedDraft }: UseChatIssuesArgs) {
  const conversations = useAppStore((s) => s.conversations);
  const issues = useAppStore((s) => s.issues);
  const addIssue = useAppStore((s) => s.addIssue);
  const updateIssue = useAppStore((s) => s.updateIssue);
  const resolveIssue = useAppStore((s) => s.resolveIssue);
  const incrementAnalytic = useAppStore((s) => s.incrementAnalytic);

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId],
  );

  // Last guest message for triage
  const lastGuestMessage = useMemo(() => {
    if (!conversation) return null;
    return [...(conversation.messages || [])].reverse().find((m) => m.sender === 'guest') || null;
  }, [conversation]);

  const triagedIssue = useMemo(() => {
    if (!lastGuestMessage) return null;
    const triage = triageIssueFromMessage(lastGuestMessage.content);
    return triage.isIssue ? triage : null;
  }, [lastGuestMessage]);

  const latestConversationIssue = useMemo(() => {
    const matching = issues.filter((issue) => issue.conversationId === conversationId);
    return matching.length > 0 ? matching[matching.length - 1] : null;
  }, [issues, conversationId]);

  const activeConversationIssue =
    latestConversationIssue?.status !== 'resolved' ? latestConversationIssue : null;

  const savedHandoffDraft = useMemo(() => {
    if (!activeConversationIssue?.notes) return null;
    return activeConversationIssue.notes.startsWith('Handoff:')
      ? activeConversationIssue.notes
      : null;
  }, [activeConversationIssue?.notes]);

  // Collapse state
  const issueTriageStorageKey = conversation?.id
    ? `issue-triage-collapsed:${conversation.id}`
    : null;
  const [issueTriageCollapsed, setIssueTriageCollapsed] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadIssueTriagePreference() {
      if (
        !issueTriageStorageKey ||
        !triagedIssue ||
        latestConversationIssue?.status === 'resolved'
      ) {
        if (!cancelled) setIssueTriageCollapsed(false);
        return;
      }

      const stored = await AsyncStorage.getItem(issueTriageStorageKey);
      if (!cancelled) {
        if (stored === '1') {
          setIssueTriageCollapsed(true);
        } else if (stored === '0') {
          setIssueTriageCollapsed(false);
        } else {
          setIssueTriageCollapsed(!!currentEnhancedDraft);
        }
      }
    }

    loadIssueTriagePreference();
    return () => {
      cancelled = true;
    };
  }, [issueTriageStorageKey, triagedIssue, latestConversationIssue?.status, currentEnhancedDraft]);

  const toggleIssueTriageCollapsed = useCallback(async () => {
    const next = !issueTriageCollapsed;
    setIssueTriageCollapsed(next);
    if (issueTriageStorageKey) {
      await AsyncStorage.setItem(issueTriageStorageKey, next ? '1' : '0');
    }
  }, [issueTriageCollapsed, issueTriageStorageKey]);

  const ensureConversationIssue = useCallback(() => {
    if (!triagedIssue) return null;
    if (activeConversationIssue) return activeConversationIssue;

    const now = new Date();
    const nextIssue = {
      id: `issue-${conversationId}-${now.getTime()}`,
      conversationId,
      category: triagedIssue.category,
      description: triagedIssue.summary,
      status: 'open' as const,
      priority: triagedIssue.priority,
      createdAt: now,
      notes: lastGuestMessage?.content || '',
    };
    addIssue(nextIssue);
    return nextIssue;
  }, [triagedIssue, activeConversationIssue, conversationId, addIssue, lastGuestMessage]);

  const handleIssueNeedsFollowUp = useCallback(() => {
    const issue = ensureConversationIssue();
    if (!issue) return;
    updateIssue(issue.id, {
      status: 'in_progress',
      notes: issue.notes || lastGuestMessage?.content || '',
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [ensureConversationIssue, updateIssue, lastGuestMessage]);

  const handleIssueCreateHandoff = useCallback(async () => {
    if (!triagedIssue) return;
    const issue = ensureConversationIssue();
    if (!issue) return;

    const handoffDraft = buildIssueHandoffDraft({
      propertyName: conversation?.property?.name || 'the property',
      issue: triagedIssue,
      guestName: conversation?.guest?.name || 'Guest',
      guestMessage: lastGuestMessage?.content || '',
      stayWindow:
        conversation?.checkInDate && conversation?.checkOutDate
          ? `${format(new Date(conversation.checkInDate), 'MMM d')} - ${format(new Date(conversation.checkOutDate), 'MMM d')}`
          : null,
    });

    updateIssue(issue.id, { status: 'in_progress', notes: handoffDraft });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Alert.alert('Issue handoff ready', 'Choose how you want to use this handoff draft.', [
      {
        text: 'Copy',
        onPress: async () => {
          await Clipboard.setStringAsync(handoffDraft);
        },
      },
      {
        text: 'Share',
        onPress: async () => {
          await Share.share({ message: handoffDraft });
        },
      },
      { text: 'Save for later', style: 'cancel' },
    ]);
  }, [triagedIssue, ensureConversationIssue, conversation, lastGuestMessage, updateIssue]);

  const handleIssueResumeHandoff = useCallback(async () => {
    if (!savedHandoffDraft) return;
    Alert.alert('Saved handoff draft', savedHandoffDraft, [
      {
        text: 'Copy',
        onPress: async () => {
          await Clipboard.setStringAsync(savedHandoffDraft);
        },
      },
      {
        text: 'Share',
        onPress: async () => {
          await Share.share({ message: savedHandoffDraft });
        },
      },
      { text: 'Close', style: 'cancel' },
    ]);
  }, [savedHandoffDraft]);

  const handleIssueMarkResolved = useCallback(() => {
    if (!activeConversationIssue) return;
    resolveIssue(activeConversationIssue.id);
    incrementAnalytic('issuesResolved');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [activeConversationIssue, resolveIssue, incrementAnalytic]);

  return {
    triagedIssue,
    latestConversationIssue,
    issueTriageCollapsed,
    savedHandoffDraft,
    toggleIssueTriageCollapsed,
    handleIssueNeedsFollowUp,
    handleIssueCreateHandoff,
    handleIssueResumeHandoff,
    handleIssueMarkResolved,
  };
}
