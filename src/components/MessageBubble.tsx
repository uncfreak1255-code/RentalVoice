import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { useAppStore, type Message } from '@/lib/store';
import { Sparkles, Check, CheckCheck, Star } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/ui/Avatar';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';

interface MessageBubbleProps {
  message: Message;
  guestAvatar?: string;
  guestName?: string;
  showAvatar?: boolean;
  conversationId?: string;
  propertyId?: string;
}

export function MessageBubble({
  message,
  guestAvatar,
  guestName,
  showAvatar = true,
  conversationId,
  propertyId,
}: MessageBubbleProps) {
  const isGuest = message.sender === 'guest';
  const isAiDraft = message.sender === 'ai_draft';
  const isHost = message.sender === 'host';

  // Store actions for favorites
  const addFavoriteMessage = useAppStore((s) => s.addFavoriteMessage);
  const removeFavoriteMessage = useAppStore((s) => s.removeFavoriteMessage);
  const favoriteMessages = useAppStore((s) => s.favoriteMessages);

  const isFavorite = useMemo(() => {
    return favoriteMessages.some((f) => f.messageId === message.id);
  }, [favoriteMessages, message.id]);

  const favoriteEntry = useMemo(() => {
    return favoriteMessages.find((f) => f.messageId === message.id);
  }, [favoriteMessages, message.id]);

  const toggleFavorite = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isFavorite && favoriteEntry) {
      removeFavoriteMessage(favoriteEntry.id);
    } else {
      addFavoriteMessage({
        id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        messageId: message.id,
        conversationId: conversationId || message.conversationId,
        content: message.content,
        guestIntent: message.detectedIntent || 'general',
        propertyId: propertyId || '',
        createdAt: new Date(),
      });
    }
  }, [isFavorite, favoriteEntry, message, conversationId, propertyId, addFavoriteMessage, removeFavoriteMessage]);

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      style={[styles.row, isGuest ? styles.rowGuest : styles.rowHost]}
    >
      {/* Guest avatar */}
      {isGuest && showAvatar && (
        <Avatar
          name={guestName || 'G'}
          imageUrl={guestAvatar}
          size="sm"
        />
      )}
      {isGuest && !showAvatar && <View style={styles.avatarSpacer} />}

      {/* Message bubble */}
      <View
        style={[
          styles.bubble,
          isGuest && styles.bubbleGuest,
          isHost && styles.bubbleHost,
          isAiDraft && styles.bubbleAiDraft,
        ]}
      >
        {/* AI Draft indicator */}
        {isAiDraft && (
          <View style={styles.aiDraftHeader}>
            <Sparkles size={12} color={colors.primary.DEFAULT} />
            <Text style={styles.aiDraftLabel}>
              AI Draft • {message.aiConfidence}% confidence
            </Text>
          </View>
        )}

        {/* Message content */}
        <Text
          style={[
            styles.messageText,
            isGuest && styles.messageTextGuest,
            isHost && styles.messageTextHost,
            isAiDraft && styles.messageTextAiDraft,
          ]}
        >
          {message.content}
        </Text>

        {/* Timestamp, read status, and favorite button */}
        <View style={styles.meta}>
          {/* Favorite star for host messages */}
          {isHost && (
            <Pressable
              onPress={toggleFavorite}
              style={styles.favoriteButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Star
                size={12}
                color={isFavorite ? colors.warning.DEFAULT : 'rgba(255,255,255,0.4)'}
                fill={isFavorite ? colors.warning.DEFAULT : 'transparent'}
              />
            </Pressable>
          )}
          <Text
            style={[
              styles.timestamp,
              isGuest ? styles.timestampGuest : styles.timestampHost,
            ]}
          >
            {format(message.timestamp, 'h:mm a')}
          </Text>
          {(isHost || isAiDraft) && (
            <View style={styles.readIndicator}>
              {message.isRead ? (
                <CheckCheck size={12} color={isAiDraft ? colors.primary.DEFAULT : 'rgba(255,255,255,0.6)'} />
              ) : (
                <Check size={12} color={isAiDraft ? colors.primary.DEFAULT : 'rgba(255,255,255,0.6)'} />
              )}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing['2'],
    paddingHorizontal: spacing['4'],
  },
  rowGuest: {
    justifyContent: 'flex-start',
  },
  rowHost: {
    justifyContent: 'flex-end',
  },
  avatarSpacer: {
    width: 40,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: radius.xl,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  bubbleGuest: {
    backgroundColor: colors.bg.elevated,
    borderTopLeftRadius: 4,
    marginLeft: spacing['2'],
  },
  bubbleHost: {
    backgroundColor: colors.accent.DEFAULT,
    borderTopRightRadius: 4,
  },
  bubbleAiDraft: {
    backgroundColor: colors.primary.muted,
    borderWidth: 1,
    borderColor: `${colors.primary.DEFAULT}50`,
    borderTopRightRadius: 4,
  },
  aiDraftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['2'],
    paddingBottom: spacing['2'],
    borderBottomWidth: 1,
    borderBottomColor: `${colors.primary.DEFAULT}30`,
  },
  aiDraftLabel: {
    color: colors.primary.DEFAULT,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1'],
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: typography.fontFamily.regular,
  },
  messageTextGuest: {
    color: colors.text.primary,
  },
  messageTextHost: {
    color: '#FFFFFF',
  },
  messageTextAiDraft: {
    color: colors.text.secondary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing['1.5'],
  },
  favoriteButton: {
    marginRight: spacing['2'],
    padding: 2,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
  },
  timestampGuest: {
    color: colors.text.muted,
  },
  timestampHost: {
    color: 'rgba(255,255,255,0.6)',
  },
  readIndicator: {
    marginLeft: spacing['1'],
  },
});
