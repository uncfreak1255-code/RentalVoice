import React, { memo, useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import type { Conversation } from '@/lib/store';
import type { SentimentType } from '@/lib/sentiment-analysis';
import { guestMemoryManager } from '@/lib/advanced-training';
import { PremiumPressable } from '@/components/ui/PremiumPressable';
import { SentimentDot, type SentimentLevel } from '@/components/ui/SentimentDot';
import { colors, spacing, typography } from '@/lib/design-tokens';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
  isSelected?: boolean;
  sentiment?: SentimentType;
}

// Collapse the six-way SentimentType down to the four dots the UI shows.
function toDotLevel(s?: SentimentType): SentimentLevel {
  if (s === 'urgent') return 'urgent';
  if (s === 'frustrated' || s === 'negative') return 'negative';
  if (s === 'positive' || s === 'excited') return 'positive';
  return 'neutral';
}

// ── Time formatting ────────────────────────────
function formatTimestamp(date: Date): string {
  const now = new Date();

  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateRange(checkIn?: Date, checkOut?: Date): string | null {
  if (!checkIn) return null;
  const fmtFull = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!checkOut) return fmtFull(checkIn);
  return `${fmtFull(checkIn)} — ${fmtFull(checkOut)}`;
}

function parseTimestamp(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts === 'number') {
    return ts < 10_000_000_000 ? new Date(ts * 1000) : new Date(ts);
  }
  return new Date();
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  '#2DD4A8', '#14B8A6', '#F97316', '#8B5CF6', '#3B82F6',
  '#F59E0B', '#EC4899', '#06B6D4', '#10B981', '#6366F1',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const PLATFORM_BADGES: Record<string, { bg: string; label: string }> = {
  airbnb:  { bg: colors.platform.airbnb, label: 'A' },
  vrbo:    { bg: colors.platform.vrbo, label: 'V' },
  booking: { bg: colors.platform.booking, label: 'B' },
  direct:  { bg: colors.platform.direct, label: 'D' },
};

// ───────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────
export const ConversationItem = memo(function ConversationItem({
  conversation,
  onPress,
  isSelected,
  sentiment,
}: ConversationItemProps) {
  const { guest, property, lastMessage, unreadCount, checkInDate, checkOutDate, hasAiDraft, aiDraftConfidence } = conversation;
  const lastSender = lastMessage?.sender;
  const isUnread = unreadCount > 0 && lastSender !== 'host';
  const isYou = lastSender === 'host';
  const guestMemory = useMemo(() => {
    if (!guest?.email && !guest?.phone) return null;
    return guestMemoryManager.getGuestMemory(guest.email, guest.phone);
  }, [guest?.email, guest?.phone]);
  const showReturningBadge = Boolean(guestMemory?.preferences.isReturning);

  const sentimentLevel = toDotLevel(sentiment);
  const isUrgent = sentimentLevel === 'urgent';

  const lastMessagePreview = useMemo(() => {
    if (!lastMessage?.content) return 'No messages yet';
    const clean = lastMessage.content.replace(/\n/g, ' ').trim();
    const truncated = clean.length > 120 ? clean.slice(0, 120) + '…' : clean;
    if (lastSender === 'host') return `You: ${truncated}`;
    return truncated;
  }, [lastMessage, lastSender]);

  const timestamp = useMemo(() => {
    if (lastMessage?.timestamp) return formatTimestamp(parseTimestamp(lastMessage.timestamp));
    const msgs = conversation.messages;
    if (msgs && msgs.length > 0) {
      const mostRecent = msgs[msgs.length - 1];
      if (mostRecent?.timestamp) return formatTimestamp(parseTimestamp(mostRecent.timestamp));
    }
    if (conversation.checkInDate) return formatTimestamp(new Date(conversation.checkInDate));
    return '';
  }, [lastMessage, conversation.messages, conversation.checkInDate]);

  const dateRange = useMemo(() => {
    const cin = checkInDate ? new Date(checkInDate) : undefined;
    const cout = checkOutDate ? new Date(checkOutDate) : undefined;
    return formatDateRange(cin, cout);
  }, [checkInDate, checkOutDate]);

  const initials = getInitials(guest.name || 'Guest');
  const avatarBg = useMemo(() => getAvatarColor(guest.name || 'Guest'), [guest.name]);
  const hasGuestAvatar = !!guest?.avatar;
  const platform = conversation.platform;
  const platformMeta = platform ? PLATFORM_BADGES[platform] : null;

  const draftConf = typeof aiDraftConfidence === 'number' ? Math.round(aiDraftConfidence) : null;

  return (
    <PremiumPressable
      onPress={onPress}
      scaleTo={0.98}
      hapticFeedback="light"
      accessibilityLabel={`${guest.name || 'Unknown Guest'}${isUnread ? ', unread' : ''}. ${lastMessagePreview}. ${dateRange || ''}. ${property?.name || ''}`}
      accessibilityHint="Opens conversation"
      style={({ pressed }) => [
        styles.row,
        isSelected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {/* Urgency rail — 3px danger bar, only for urgent */}
      {isUrgent ? <View style={styles.urgencyRail} /> : null}

      {/* ── Avatar ── */}
      <View style={styles.avatarContainer}>
        <View
          style={[
            styles.avatarRingWrap,
            showReturningBadge && styles.avatarRingReturning,
          ]}
        >
          {hasGuestAvatar ? (
            <Image source={{ uri: guest.avatar }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>
        {platformMeta ? (
          <View style={[styles.channelBadge, { backgroundColor: platformMeta.bg }]}>
            <Text style={styles.channelBadgeText}>{platformMeta.label}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {/* Row 1: [sentiment] Name [Returning] time */}
        <View style={styles.nameRow}>
          {sentimentLevel !== 'neutral' ? (
            <View style={styles.sentimentWrap}>
              <SentimentDot level={sentimentLevel} />
            </View>
          ) : null}
          <Text style={[styles.guestName, isUnread && styles.guestNameUnread]} numberOfLines={1}>
            {guest.name || 'Unknown Guest'}
          </Text>
          {showReturningBadge ? (
            <View style={styles.returningTag}>
              <Text style={styles.returningTagText}>Returning</Text>
            </View>
          ) : null}
          {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
        </View>

        {/* Row 2: platform dot + property + dates */}
        {(property?.name || dateRange) ? (
          <View style={styles.propertyRow}>
            {platformMeta ? <View style={[styles.platformBar, { backgroundColor: platformMeta.bg }]} /> : null}
            <Text style={styles.propertyInfo} numberOfLines={1}>
              {property?.name ?? ''}
              {property?.name && dateRange ? ' · ' : ''}
              {dateRange ?? ''}
            </Text>
          </View>
        ) : null}

        {/* Row 3: preview + AI draft badge + unread count */}
        <View style={styles.previewRow}>
          <Text
            style={[styles.messagePreview, isUnread && !isYou && styles.messagePreviewUnread]}
            numberOfLines={1}
          >
            {lastMessagePreview}
          </Text>
          <View style={styles.metaBadges}>
            {hasAiDraft ? (
              <View style={styles.draftBadge}>
                <Sparkles size={10} color={colors.ai.DEFAULT} strokeWidth={2.5} />
                {draftConf !== null ? <Text style={styles.draftBadgeText}>{draftConf}%</Text> : null}
              </View>
            ) : null}
            {unreadCount > 0 && !isYou ? (
              <View style={styles.unreadCount}>
                <Text style={styles.unreadCountText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </PremiumPressable>
  );
});

// ───────────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    backgroundColor: colors.bg.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
    position: 'relative',
  },
  selected: { backgroundColor: colors.bg.subtle },
  pressed: { backgroundColor: colors.bg.hover },

  urgencyRail: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.danger.DEFAULT,
  },

  // ── Avatar ──
  avatarContainer: {
    width: 44,
    height: 44,
    marginRight: spacing['3'],
    marginTop: 2,
  },
  avatarRingWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingReturning: {
    borderWidth: 2.5,
    borderColor: colors.primary.DEFAULT,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.inverse,
    letterSpacing: 0.5,
  },
  channelBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg.card,
  },
  channelBadgeText: {
    fontSize: 8,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.inverse,
  },

  // ── Content ──
  content: {
    flex: 1,
    overflow: 'hidden',
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sentimentWrap: {
    marginRight: 2,
  },
  guestName: {
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.primary,
    letterSpacing: -0.1,
    flex: 1,
  },
  guestNameUnread: {
    fontFamily: typography.fontFamily.bold,
  },
  returningTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.primary.soft,
  },
  returningTagText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary.DEFAULT,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  timestamp: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.disabled,
    flexShrink: 0,
  },

  // ── Row 2: property + platform bar
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  platformBar: {
    width: 6,
    height: 6,
    borderRadius: 2,
    flexShrink: 0,
  },
  propertyInfo: {
    fontSize: 12.5,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.muted,
    flex: 1,
  },

  // ── Row 3: preview + badges
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messagePreview: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 18,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.muted,
  },
  messagePreviewUnread: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
  },
  metaBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.ai.soft,
  },
  draftBadgeText: {
    fontSize: 10.5,
    fontFamily: typography.fontFamily.bold,
    color: colors.ai.DEFAULT,
    letterSpacing: 0.2,
  },
  unreadCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: colors.accent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCountText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.inverse,
  },
});
