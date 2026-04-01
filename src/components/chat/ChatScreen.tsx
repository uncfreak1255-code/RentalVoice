import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import type { Message } from '@/lib/store';
import { MessageComposer } from '../MessageComposer';
import { AIDraftActionsSheet } from '../AIDraftActionsSheet';
import { GuestProfileScreen } from '../GuestProfileScreen';
import type BottomSheet from '@gorhom/bottom-sheet';
import { guestMemoryManager } from '@/lib/advanced-training';
import { AlertTriangle } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';
import { useThemeColors } from '@/lib/useThemeColors';
import type { ChatScreenProps } from './types';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { useChatDraftEngine } from './useChatDraftEngine';
import { useChatIssues } from './useChatIssues';
import { DemoModeBanner } from '../DemoModeBanner';

export function ChatScreen({ conversationId, onBack, onOpenUpsells }: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const t = useThemeColors();
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const listRef = useRef<FlatList<Message>>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [showGuestInfo, setShowGuestInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showGuestProfile, setShowGuestProfile] = useState(false);

  const conversations = useAppStore((s) => s.conversations);
  const markAsRead = useAppStore((s) => s.markAsRead);
  const autoPilotEnabled = useAppStore((s) => s.settings.autoPilotEnabled);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId],
  );

  const messages = conversation?.messages ?? [];

  // Draft engine — all AI draft generation & message handling
  const draftEngine = useChatDraftEngine({ conversationId, onOpenUpsells });

  // Issue triage
  const issueState = useChatIssues({
    conversationId,
    currentEnhancedDraft: draftEngine.currentEnhancedDraft,
  });

  // Guest memory
  const guestMemory = useMemo(() => {
    if (!conversation?.guest?.email && !conversation?.guest?.phone) return null;
    return guestMemoryManager.getGuestMemory(
      conversation?.guest?.email,
      conversation?.guest?.phone,
    );
  }, [conversation?.guest?.email, conversation?.guest?.phone]);
  const guestStayCount = guestMemory?.conversationHistory.length ?? 0;
  const guestMemoryStorageKey = conversation?.id ? `guest-memory-collapsed:${conversation.id}` : null;
  const [guestMemoryCollapsed, setGuestMemoryCollapsed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadGuestMemoryPreference() {
      if (!guestMemoryStorageKey || !guestMemory?.preferences.isReturning || guestStayCount === 0) {
        if (!cancelled) setGuestMemoryCollapsed(false);
        return;
      }
      const stored = await AsyncStorage.getItem(guestMemoryStorageKey);
      if (!cancelled) setGuestMemoryCollapsed(stored === '1');
    }
    loadGuestMemoryPreference();
    return () => { cancelled = true; };
  }, [guestMemory?.preferences.isReturning, guestMemoryStorageKey, guestStayCount]);

  const toggleGuestMemoryCollapsed = useCallback(async () => {
    const next = !guestMemoryCollapsed;
    setGuestMemoryCollapsed(next);
    if (guestMemoryStorageKey) {
      await AsyncStorage.setItem(guestMemoryStorageKey, next ? '1' : '0');
    }
  }, [guestMemoryCollapsed, guestMemoryStorageKey]);

  // Mark as read on mount
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0) {
      markAsRead(conversationId);
    }
  }, [conversationId, conversation, markAsRead]);

  // Scroll to bottom when AI draft appears
  useEffect(() => {
    if (draftEngine.currentEnhancedDraft && listRef.current) {
      setTimeout(() => {
        try {
          listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        } catch {}
      }, 300);
    }
  }, [draftEngine.currentEnhancedDraft]);

  // Filter out AI drafts for display
  const displayMessages = useMemo(() => {
    if (!conversation) return [];
    const nonDraft = messages.filter((m) => m.sender !== 'ai_draft');
    if (!searchQuery.trim()) return nonDraft;
    const q = searchQuery.toLowerCase();
    return nonDraft.filter((m) => m.content.toLowerCase().includes(q));
  }, [conversation, messages, searchQuery]);

  // -- Early returns (below hooks) --
  if (!conversation) {
    return (
      <SafeAreaView style={[styles.emptyContainer, { backgroundColor: t.bg.base }]} edges={['top', 'bottom']}>
        <AlertTriangle size={32} color={t.text.muted} />
        <Text style={styles.emptyHeading}>Conversation unavailable</Text>
        <Text style={styles.emptySubtext}>
          This conversation may have been removed or isn't synced yet.
        </Text>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to inbox"
          style={({ pressed }) => [styles.emptyAction, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.emptyActionText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (showGuestProfile) {
    return (
      <GuestProfileScreen
        conversation={conversation}
        onBack={() => setShowGuestProfile(false)}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.bg.subtle }]}>
      <LinearGradient
        colors={[t.bg.elevated, t.bg.subtle]}
        style={styles.headerGradient}
      />

      <SafeAreaView style={styles.flex1} edges={['top']}>
        {isDemoMode && (
          <DemoModeBanner onExitDemo={() => {
            useAppStore.getState().exitDemoMode();
            onBack();
          }} />
        )}
        <ChatHeader
          conversation={conversation}
          onBack={onBack}
          onShowGuestProfile={() => setShowGuestProfile(true)}
          isSearchOpen={isSearchOpen}
          searchQuery={searchQuery}
          onToggleSearch={() => {
            setIsSearchOpen(!isSearchOpen);
            if (isSearchOpen) setSearchQuery('');
          }}
          onSearchQueryChange={setSearchQuery}
          showGuestInfo={showGuestInfo}
          onToggleGuestInfo={() => setShowGuestInfo(!showGuestInfo)}
          editLearningSummary={draftEngine.editLearningSummary}
          learningToastType={draftEngine.learningToastType}
          triagedIssue={issueState.triagedIssue}
          latestConversationIssue={issueState.latestConversationIssue}
          issueTriageCollapsed={issueState.issueTriageCollapsed}
          savedHandoffDraft={issueState.savedHandoffDraft}
          onToggleIssueTriageCollapsed={issueState.toggleIssueTriageCollapsed}
          onIssueNeedsFollowUp={issueState.handleIssueNeedsFollowUp}
          onIssueCreateHandoff={issueState.handleIssueCreateHandoff}
          onIssueResumeHandoff={issueState.handleIssueResumeHandoff}
          onIssueMarkResolved={issueState.handleIssueMarkResolved}
          guestMemory={guestMemory}
          guestStayCount={guestStayCount}
          guestMemoryCollapsed={guestMemoryCollapsed}
          onToggleGuestMemoryCollapsed={toggleGuestMemoryCollapsed}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex1}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
        >
          <View style={styles.flex1}>
            <ChatMessageList
              displayMessages={displayMessages}
              guestAvatar={conversation.guest?.avatar}
              guestName={conversation.guest?.name || 'Guest'}
              conversationId={conversationId}
              propertyId={conversation.property?.id}
              searchQuery={searchQuery}
              listRef={listRef}
            />
          </View>

          <MessageComposer
            onSend={draftEngine.handleSendMessage}
            onApproveAiDraft={draftEngine.handleApproveAiDraft}
            onRegenerateAiDraft={draftEngine.handleRegenerateAiDraft}
            onEditAiDraft={draftEngine.handleEditAiDraft}
            onDismissAiDraft={draftEngine.handleDismissAiDraft}
            aiDraft={draftEngine.currentEnhancedDraft}
            isGenerating={draftEngine.isGeneratingDraft}
            autoPilotEnabled={autoPilotEnabled}
            onFixConflict={draftEngine.handleFixConflict}
            onOpenActionsSheet={() => bottomSheetRef.current?.snapToIndex(0)}
            rateLimitError={draftEngine.rateLimitError}
            onDismissRateLimitError={draftEngine.dismissComposerNotice}
            rateLimitActionLabel={draftEngine.rateLimitActionLabel}
            onRateLimitAction={
              draftEngine.rateLimitActionLabel && onOpenUpsells ? onOpenUpsells : undefined
            }
          />
        </KeyboardAvoidingView>

        {draftEngine.currentEnhancedDraft && (
          <AIDraftActionsSheet
            bottomSheetRef={bottomSheetRef}
            onApprove={draftEngine.handleApproveAiDraft}
            onEdit={() => {}}
            onDismiss={draftEngine.handleDismissAiDraft}
            onRegenerate={draftEngine.handleRegenerateAiDraft}
            confidence={draftEngine.currentEnhancedDraft.confidence}
            sentiment={draftEngine.currentEnhancedDraft.sentiment}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.subtle,
  },
  flex1: {
    flex: 1,
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 150,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['8'],
  },
  emptyHeading: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 17,
    marginTop: spacing['4'],
    textAlign: 'center' as const,
  },
  emptySubtext: {
    color: colors.text.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    marginTop: spacing['2'],
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  emptyAction: {
    marginTop: spacing['6'],
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['3'],
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: radius.md,
  },
  emptyActionText: {
    color: colors.text.inverse,
    fontFamily: typography.fontFamily.medium,
    fontSize: 15,
  },
});
