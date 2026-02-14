import React, { memo, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { format, isToday, isYesterday } from 'date-fns';
import type { Conversation } from '@/lib/store';
import { Sparkles, Users, Calendar, AlertTriangle } from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';
import { analyzeConversationSentiment } from '@/lib/sentiment-analysis';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
  isSelected?: boolean;
}

function formatMessageTime(date: Date): string {
  const now = new Date();
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) return 'Yesterday';
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return format(date, 'EEE');
  return format(date, 'MMM d');
}

function formatDateRange(checkIn?: Date, checkOut?: Date): string {
  if (!checkIn) return '';
  const fmt = (d: Date) => format(d, 'MMM d');
  if (checkOut) return `${fmt(checkIn)} – ${fmt(checkOut)}`;
  return fmt(checkIn);
}

type TagVariant = 'primary' | 'accent' | 'danger' | 'success' | 'warning' | 'muted';

function getConversationTag(
  conversation: Conversation,
  sentiment: string
): { label: string; variant: TagVariant; icon?: React.ComponentType<any> } | null {
  if (conversation.status === 'urgent') {
    return { label: 'Escalated', variant: 'danger', icon: AlertTriangle };
  }
  if (conversation.hasAiDraft) {
    const confidence = conversation.aiDraftConfidence || 0;
    return {
      label: `AI Draft ${confidence}%`,
      variant: 'primary',
      icon: Sparkles,
    };
  }
  if (sentiment === 'negative' || sentiment === 'frustrated') {
    return { label: 'Needs Attention', variant: 'warning' };
  }
  if (conversation.workflowStatus === 'resolved') {
    return { label: 'Resolved', variant: 'success' };
  }
  return null;
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  onPress,
  isSelected,
}: ConversationItemProps) {
  const {
    guest,
    property,
    lastMessage,
    unreadCount,
    platform,
    checkInDate,
    checkOutDate,
    numberOfGuests,
  } = conversation;

  const sentimentData = useMemo(() => {
    try {
      return analyzeConversationSentiment(conversation);
    } catch {
      return { currentSentiment: 'neutral' as const, conversationId: '', sentimentHistory: [], overallTrend: 'stable' as const, escalationRequired: false, lastAnalyzedAt: new Date() };
    }
  }, [conversation]);

  const tagInfo = useMemo(
    () => getConversationTag(conversation, sentimentData.currentSentiment),
    [conversation, sentimentData.currentSentiment]
  );

  const isUnread = unreadCount > 0;
  const dateRange = formatDateRange(checkInDate, checkOutDate);

  const lastMessagePreview = useMemo(() => {
    if (!lastMessage?.content) return 'No messages yet';
    const clean = lastMessage.content.replace(/\n/g, ' ').trim();
    return clean.length > 90 ? clean.slice(0, 90) + '…' : clean;
  }, [lastMessage]);

  const timestamp = lastMessage?.timestamp
    ? formatMessageTime(new Date(lastMessage.timestamp))
    : '';

  const platformLabel =
    platform === 'airbnb'
      ? 'Airbnb'
      : platform === 'vrbo'
      ? 'Vrbo'
      : platform === 'booking'
      ? 'Booking'
      : 'Direct';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        isSelected && styles.selected,
        pressed && styles.pressed,
        isUnread && styles.unread,
      ]}
    >
      {/* Avatar */}
      <Avatar
        name={guest.name || 'Guest'}
        imageUrl={guest.avatar}
        size="lg"
        platformIcon={platform as any}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Top Row: Name + Time */}
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.guestName,
                isUnread && styles.guestNameUnread,
              ]}
              numberOfLines={1}
            >
              {guest.name || 'Unknown Guest'}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>

        {/* Property + Platform */}
        <View style={styles.propertyRow}>
          <Text style={styles.propertyName} numberOfLines={1}>
            {property?.name || 'Unknown Property'}
          </Text>
          <View style={[styles.platformDot, { backgroundColor: colors.platform[platform || 'direct'] }]} />
          <Text style={styles.platformLabel}>{platformLabel}</Text>
        </View>

        {/* Message Preview */}
        <Text
          style={[
            styles.messagePreview,
            isUnread && styles.messagePreviewUnread,
          ]}
          numberOfLines={2}
        >
          {lastMessagePreview}
        </Text>

        {/* Bottom Row: Guests, Dates, Tag */}
        <View style={styles.bottomRow}>
          {numberOfGuests != null && numberOfGuests > 0 && (
            <View style={styles.metaItem}>
              <Users size={12} color={colors.text.muted} />
              <Text style={styles.metaText}>{numberOfGuests}</Text>
            </View>
          )}

          {dateRange ? (
            <View style={styles.metaItem}>
              <Calendar size={12} color={colors.text.muted} />
              <Text style={styles.metaText}>{dateRange}</Text>
            </View>
          ) : null}

          <View style={{ flex: 1 }} />

          {tagInfo && (
            <Badge
              label={tagInfo.label}
              variant={tagInfo.variant}
              size="sm"
            />
          )}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    gap: spacing['3'],
    backgroundColor: colors.bg.card,
    marginHorizontal: spacing['3'],
    marginTop: spacing['2'],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  selected: {
    backgroundColor: colors.bg.elevated,
    borderColor: colors.primary.muted,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  unread: {
    borderColor: colors.primary.soft,
    backgroundColor: `${colors.bg.card}`,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing['2'],
  },
  guestName: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.secondary,
  },
  guestNameUnread: {
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.DEFAULT,
    marginLeft: spacing['2'],
  },
  timestamp: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.muted,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: spacing['1'],
  },
  propertyName: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.muted,
    flex: 1,
  },
  platformDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  platformLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.disabled,
  },
  messagePreview: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.disabled,
    marginTop: spacing['1.5'],
  },
  messagePreviewUnread: {
    color: colors.text.muted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['2'],
    gap: spacing['3'],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1'],
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.muted,
  },
});
