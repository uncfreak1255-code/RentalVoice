import React, { memo, useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Conversation } from '@/lib/store';
import { PremiumPressable } from '@/components/ui/PremiumPressable';
import { typography } from '@/lib/design-tokens';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
  isSelected?: boolean;
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

// Format date range: "Mar 8 — Mar 15"
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


// Platform badge config — colors match each channel's brand
const PLATFORM_BADGES: Record<string, { bg: string; label: string }> = {
  airbnb:  { bg: '#FF5A5F', label: 'A' },
  vrbo:    { bg: '#3B5998', label: 'V' },
  booking: { bg: '#003580', label: 'B' },
  direct:  { bg: '#34C759', label: 'D' },
};

// Determine inline intent tags shown next to the guest name
function getInlineTags(conversation: Conversation) {
  const tags: { id: string; label: string; bg: string; color: string }[] = [];

  // Inquiry pill — shown for pre-booking conversations (no reservation yet)
  if (conversation.isInquiry) {
    tags.push({ id: 'inquiry', label: 'Inquiry', bg: '#D1FAE5', color: '#059669' });
  }

  return tags;
}



// ───────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────
export const ConversationItem = memo(function ConversationItem({
  conversation,
  onPress,
  isSelected,
}: ConversationItemProps) {
  const { guest, property, lastMessage, unreadCount, checkInDate, checkOutDate } = conversation;
  const lastSender = lastMessage?.sender;
  const isUnread = unreadCount > 0 && lastSender !== 'host';

  const lastMessagePreview = useMemo(() => {
    if (!lastMessage?.content) return 'No messages yet';
    const clean = lastMessage.content.replace(/\n/g, ' ').trim();
    const truncated = clean.length > 120 ? clean.slice(0, 120) + '…' : clean;
    if (lastSender === 'host') return `You: ${truncated}`;
    const firstName = guest.name?.split(' ')[0] || 'Guest';
    return `${firstName}: ${truncated}`;
  }, [lastMessage, lastSender, guest.name]);

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

  const inlineTags = useMemo(() => getInlineTags(conversation), [conversation]);

  const initials = getInitials(guest.name || 'Guest');
  const avatarBg = useMemo(() => getAvatarColor(guest.name || 'Guest'), [guest.name]);
  const hasGuestAvatar = !!guest?.avatar;


  return (
    <PremiumPressable
      onPress={onPress}
      scaleTo={0.98}
      hapticFeedback="light"
      accessibilityLabel={`${guest.name || 'Unknown Guest'}${isUnread ? ', unread' : ''}. ${lastMessagePreview}. ${dateRange || ''}. ${property?.name || ''}`}
      accessibilityHint="Opens conversation"
      style={({ pressed }) => [
        styles.row,
        isUnread && styles.unreadRow,
        isSelected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {/* ── Avatar ── */}
      <View style={styles.avatarContainer}>
        {hasGuestAvatar ? (
          <Image source={{ uri: guest.avatar }} style={styles.avatar} resizeMode="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        {/* Channel badge overlay */}
        {conversation.platform && PLATFORM_BADGES[conversation.platform] && (
          <View style={[styles.channelBadge, { backgroundColor: PLATFORM_BADGES[conversation.platform].bg }]}>
            <Text style={styles.channelBadgeText}>{PLATFORM_BADGES[conversation.platform].label}</Text>
          </View>
        )}
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {/* Row 1: Guest name + inline tags + timestamp */}
        <View style={styles.nameRow}>
          <View style={styles.nameAndTags}>
            <Text style={[styles.guestName, isUnread && styles.guestNameUnread]} numberOfLines={1}>
              {guest.name || 'Unknown Guest'}
            </Text>
            {inlineTags.map((t) => (
              <View key={t.id} style={[styles.inlineTag, { backgroundColor: t.bg }]}>
                <Text style={[styles.inlineTagText, { color: t.color }]}>{t.label}</Text>
              </View>
            ))}
          </View>
          {timestamp ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isUnread && <View style={styles.unreadDot} />}
              <Text style={styles.timestamp}>{timestamp}</Text>
            </View>
          ) : null}
        </View>

        {/* Row 2: message preview */}
        <View style={styles.messageRow}>
          <Text
            style={[styles.messagePreview, isUnread && styles.messagePreviewUnread]}
            numberOfLines={2}
          >
            {lastMessagePreview}
          </Text>
        </View>

        {/* Row 4: Date range + property name */}
        {(dateRange || property?.name) && (
          <Text style={styles.propertyInfo} numberOfLines={1}>
            {dateRange}
            {dateRange && property?.name ? '   ' : ''}
            {property?.name || ''}
          </Text>
        )}
      </View>
    </PremiumPressable>
  );
});

// ───────────────────────────────────────────────────────────────
// Styles — matching reference screenshot exactly
// ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  selected: { backgroundColor: '#F8FAFB' },
  unreadRow: { backgroundColor: '#F5F5F5' },
  pressed: { backgroundColor: '#F5F7F8' },

  // ── Avatar ──
  avatarContainer: {
    width: 38,
    height: 38,
    marginRight: 12,
    marginTop: 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ── Content ──
  content: {
    flex: 1,
    overflow: 'hidden',
  },

  // ── Row 1: Name + tags + time ──
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  nameAndTags: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  guestName: {
    fontSize: 17,
    fontFamily: typography.fontFamily.semibold,
    color: '#000000',
    flexShrink: 1,
  },
  guestNameUnread: {
    fontFamily: typography.fontFamily.bold,
  },
  inlineTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  inlineTagText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
  timestamp: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#8E8E93',
    flexShrink: 0,
  },

  // ── Row 3: Unread dot + message ──
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 4,
    flexShrink: 0,
  },
  messagePreview: {
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: '#8E8E93',
    flex: 1,
  },
  messagePreviewUnread: {
    color: '#000000',
    fontFamily: typography.fontFamily.medium,
  },

  // ── Row 4: Property info ──
  propertyInfo: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#8E8E93',
  },
  channelBadge: {
    position: 'absolute' as const,
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  channelBadgeText: {
    fontSize: 8,
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0,
  },
});

