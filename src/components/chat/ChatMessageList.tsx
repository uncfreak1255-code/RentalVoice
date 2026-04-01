import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { MessageBubble } from '../MessageBubble';
import type { Message } from '@/lib/store';
import { Search, MessageSquare } from 'lucide-react-native';
import { colors, typography, spacing } from '@/lib/design-tokens';

export interface ChatMessageListProps {
  displayMessages: Message[];
  guestAvatar?: string;
  guestName: string;
  conversationId: string;
  propertyId?: string;
  searchQuery: string;
  /** Ref forwarded so the orchestrator can scroll programmatically */
  listRef: React.RefObject<FlatList<Message> | null>;
}

function formatDateLabel(d: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 1) return 'Today';
  if (diff < 2) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function ChatMessageList({
  displayMessages,
  guestAvatar,
  guestName,
  conversationId,
  propertyId,
  searchQuery,
  listRef,
}: ChatMessageListProps) {
  const hasScrolledToBottom = useRef(false);

  // Scroll to bottom when messages change (inverted list: bottom = offset 0)
  useEffect(() => {
    if (displayMessages.length > 0 && listRef.current) {
      if (!hasScrolledToBottom.current) {
        hasScrolledToBottom.current = true;
      } else {
        setTimeout(() => {
          try {
            listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
          } catch {}
        }, 150);
      }
    }
  }, [displayMessages.length, listRef]);

  const handleContentSizeChange = useCallback(() => {
    // No-op for inverted list
  }, []);

  const handleListLayout = useCallback(() => {
    hasScrolledToBottom.current = true;
  }, []);

  const reversedMessages = [...displayMessages].reverse();

  return (
    <FlatList
      ref={listRef}
      data={reversedMessages}
      testID="chat-message-list"
      renderItem={({ item, index }) => {
        const prevMessage = index > 0 ? reversedMessages[index - 1] : null;
        const showAvatar = !prevMessage || prevMessage.sender !== item.sender;

        // Date separator: show when day changes from next message (inverted list)
        const nextMessage = index < reversedMessages.length - 1 ? reversedMessages[index + 1] : null;
        const itemDate = item.timestamp ? new Date(item.timestamp) : null;
        const nextDate = nextMessage?.timestamp ? new Date(nextMessage.timestamp) : null;
        const showDateSeparator =
          itemDate && (!nextDate || itemDate.toDateString() !== nextDate.toDateString());

        return (
          <View>
            <MessageBubble
              message={item}
              guestAvatar={guestAvatar}
              guestName={guestName}
              showAvatar={showAvatar}
              conversationId={conversationId}
              propertyId={propertyId}
            />
            {showDateSeparator && itemDate && (
              <View style={styles.dateSeparator} accessibilityRole="header">
                <View style={styles.dateSeparatorLine} />
                <Text style={styles.dateSeparatorText}>{formatDateLabel(itemDate)}</Text>
                <View style={styles.dateSeparatorLine} />
              </View>
            )}
          </View>
        );
      }}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        displayMessages.length === 0
          ? {
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: spacing['6'],
            }
          : { paddingTop: spacing['2'], paddingBottom: spacing['4'] }
      }
      ListEmptyComponent={
        searchQuery.trim() ? (
          <View style={styles.emptyListContainer}>
            <Search size={28} color={colors.text.muted} />
            <Text style={styles.emptyListHeading}>No matching messages</Text>
            <Text style={styles.emptyListSubtext}>
              Try a different search term or clear the filter.
            </Text>
          </View>
        ) : (
          <View style={styles.emptyListContainer}>
            <MessageSquare size={28} color={colors.text.muted} />
            <Text style={styles.emptyListHeading}>No messages yet</Text>
            <Text style={styles.emptyListSubtext}>
              New guest messages will appear here. You can also type a message below to start the
              conversation.
            </Text>
          </View>
        )
      }
      inverted={displayMessages.length > 0}
      initialNumToRender={20}
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleListLayout}
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  emptyListContainer: {
    alignItems: 'center' as const,
    paddingVertical: spacing['8'],
  },
  emptyListHeading: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 16,
    marginTop: spacing['3'],
    textAlign: 'center' as const,
  },
  emptyListSubtext: {
    color: colors.text.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    marginTop: spacing['1.5'],
    textAlign: 'center' as const,
    lineHeight: 20,
    maxWidth: 280,
  },
  dateSeparator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['3'],
    marginVertical: spacing['1'],
  },
  dateSeparatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.muted,
    paddingHorizontal: spacing['3'],
    letterSpacing: 0.3,
  },
});
