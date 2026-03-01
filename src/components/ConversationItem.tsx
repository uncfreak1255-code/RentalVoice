import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Conversation } from '@/lib/store';
import { AlertTriangle } from 'lucide-react-native';
import { PremiumPressable } from '@/components/ui/PremiumPressable';
import { colors, typography, spacing } from '@/lib/design-tokens';
import { analyzeConversationSentiment } from '@/lib/sentiment-analysis';
import { detectIntent } from '@/lib/intent-detection';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
  isSelected?: boolean;
}

// ── Time formatting (Hostaway-style: actual clock time) ──
// Today: "5:04 PM"   Yesterday: "Yesterday"   This week: "Mon"   Older: "Jan 15"
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today → show actual time like "5:04 PM"
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

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  // Within the last 7 days → show day name
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // Older → show "Jan 15" (or "Jan 15, 2025" if different year)
  if (date.getFullYear() !== now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format check-in/out range: "Feb 22 — Feb 27"
function formatDateRange(checkIn?: Date, checkOut?: Date): string | null {
  if (!checkIn) return null;
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!checkOut) return fmt(checkIn);
  return `${fmt(checkIn)} — ${fmt(checkOut)}`;
}

// Generate initials from name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Rork-style avatar color palette
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

// Parse timestamp from various formats
function parseTimestamp(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts === 'number') {
    return ts < 10_000_000_000 ? new Date(ts * 1000) : new Date(ts);
  }
  return new Date();
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
    checkInDate,
    checkOutDate,
  } = conversation;

  const sentimentData = useMemo(() => {
    try {
      return analyzeConversationSentiment(conversation);
    } catch {
      return { currentSentiment: 'neutral' as const, conversationId: '', sentimentHistory: [], overallTrend: 'stable' as const, escalationRequired: false, lastAnalyzedAt: new Date() };
    }
  }, [conversation]);

  const lastSender = lastMessage?.sender;
  const isUnread = unreadCount > 0 && lastSender !== 'host';

  // ── Status label: "NEW" (green) or last sender prefix ──
  const statusLabel = useMemo(() => {
    if (!lastMessage) return null;
    if (isUnread) return { text: 'NEW', color: '#10B981' }; // green for new guest message
    if (lastSender === 'host') return { text: 'REPLIED', color: '#9CA3AF' }; // gray for you replied
    return null;
  }, [lastMessage, isUnread, lastSender]);

  // ── Intent badge from last guest message ──
  const intentBadge = useMemo(() => {
    // Find the last guest message
    const lastGuestMsg = [...(conversation.messages || [])].reverse().find(m => m.sender === 'guest');
    if (!lastGuestMsg) return null;
    const result = detectIntent(lastGuestMsg.content);
    if (result.intent === 'general') return null; // Don't show badge for generic messages
    return result;
  }, [conversation.messages]);

  // ── Message preview with sender prefix: "You: ..." / "John: ..." ──
  const lastMessagePreview = useMemo(() => {
    if (!lastMessage?.content) return 'No messages yet';
    const clean = lastMessage.content.replace(/\n/g, ' ').trim();
    const truncated = clean.length > 80 ? clean.slice(0, 80) + '…' : clean;

    if (lastSender === 'host') return `You: ${truncated}`;
    const firstName = guest.name?.split(' ')[0] || 'Guest';
    return `${firstName}: ${truncated}`;
  }, [lastMessage, lastSender, guest.name]);

  // ── Actual clock time ──
  const timestamp = lastMessage?.timestamp
    ? formatTimestamp(parseTimestamp(lastMessage.timestamp))
    : '';

  // ── Date range: "Feb 22 — Feb 27" ──
  const dateRange = useMemo(() => {
    const cin = checkInDate ? new Date(checkInDate) : undefined;
    const cout = checkOutDate ? new Date(checkOutDate) : undefined;
    return formatDateRange(cin, cout);
  }, [checkInDate, checkOutDate]);

  const initials = getInitials(guest.name || 'Guest');

  return (
    <View style={styles.cardWrapper}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(guest.name || 'Guest') }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Card */}
      <PremiumPressable
        onPress={onPress}
        scaleTo={0.98}
        hapticFeedback="light"
        style={({ pressed }) => [
          styles.card,
          isSelected && styles.selected,
          pressed && styles.pressed,
        ]}
      >
        {/* Status label: NEW/REPLIED */}
        {statusLabel && (
          <Text style={[styles.statusLabel, { color: statusLabel.color }]}>
            {statusLabel.text}
          </Text>
        )}

        {/* Name row: Guest name + timestamp right-aligned (Apple Messages style) */}
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
            {sentimentData.escalationRequired && (
              <AlertTriangle size={14} color="#EF4444" style={{ marginLeft: 4 }} />
            )}
            {intentBadge && !sentimentData.escalationRequired && (
              <View style={[styles.intentBadge, { backgroundColor: intentBadge.color + '18' }]}>
                <Text style={[styles.intentBadgeText, { color: intentBadge.color }]}>
                  {intentBadge.label}
                </Text>
              </View>
            )}
          </View>
          {timestamp ? (
            <Text style={styles.timestamp}>{timestamp}</Text>
          ) : null}
        </View>

        {isUnread && <View style={styles.unreadDot} />}

        {/* Message Preview with sender prefix */}
        <Text
          style={[
            styles.messagePreview,
            isUnread && styles.messagePreviewUnread,
          ]}
          numberOfLines={1}
        >
          {lastMessagePreview}
        </Text>

        {/* Bottom info: date range + property name */}
        <View style={styles.bottomRow}>
          {dateRange && (
            <Text style={styles.dateRange} numberOfLines={1}>
              {dateRange}
            </Text>
          )}
          {dateRange && property?.name && (
            <Text style={styles.dotSeparator}>·</Text>
          )}
          <Text style={styles.propertyName} numberOfLines={1}>
            {property?.name || 'Unknown Property'}
          </Text>
        </View>
      </PremiumPressable>
    </View>
  );
});

const styles = StyleSheet.create({
  cardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  selected: {
    backgroundColor: '#F0FDFA',
  },
  pressed: {
    backgroundColor: '#FAFAFA',
  },

  // ── Status label ──
  statusLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily.regular,
    color: '#9CA3AF',
    flexShrink: 0,
    marginLeft: 8,
    textAlign: 'right' as const,
    minWidth: 70,
  },

  // ── Name row: guest name + alert icon + unread dot ──
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
    fontSize: 18,
    lineHeight: 24,
    fontFamily: typography.fontFamily.semibold,
    color: '#111827',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  guestNameUnread: {
    fontFamily: typography.fontFamily.bold,
    color: '#0F172A',
  },
  unreadDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    flexShrink: 0,
    marginLeft: 8,
  },

  // ── Message preview ──
  messagePreview: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
    marginTop: 3,
  },
  messagePreviewUnread: {
    fontFamily: typography.fontFamily.semibold,
    color: '#374151',
  },

  // ── Bottom row: date range + property name ──
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  dateRange: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: typography.fontFamily.regular,
    color: '#9CA3AF',
    flexShrink: 1,
  },
  dotSeparator: {
    fontSize: 13,
    color: '#D1D5DB',
    marginHorizontal: 6,
  },
  propertyName: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: typography.fontFamily.regular,
    color: colors.primary.DEFAULT,
    flexShrink: 1,
  },

  // ── Intent badge ──
  intentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
    flexShrink: 0,
  },
  intentBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: 0.3,
  },
});
