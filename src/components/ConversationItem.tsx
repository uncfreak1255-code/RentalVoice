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

// ── Time formatting (Airbnb-style) ────────────────────────────
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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

  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  if (date.getFullYear() !== now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format date range: "May 8 – 11" or "May 8 – Jun 1"
function formatDateRange(checkIn?: Date, checkOut?: Date): string | null {
  if (!checkIn) return null;
  const fmtFull = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!checkOut) return fmtFull(checkIn);
  if (checkIn.getMonth() === checkOut.getMonth()) {
    return `${fmtFull(checkIn)} – ${checkOut.getDate()}`;
  }
  return `${fmtFull(checkIn)} – ${fmtFull(checkOut)}`;
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

// Booking status (Airbnb-style)
function getBookingStatus(checkIn?: Date, checkOut?: Date): { label: string; isActive: boolean } {
  if (!checkIn) return { label: '', isActive: false };
  const now = new Date();
  const cin = new Date(checkIn);
  const cout = checkOut ? new Date(checkOut) : null;
  if (cout && now >= cin && now <= cout) return { label: 'Currently hosting', isActive: true };
  if (cin > now) return { label: 'Confirmed', isActive: true };
  if (cout && now > cout) return { label: 'Completed', isActive: false };
  return { label: 'Confirmed', isActive: true };
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
    const truncated = clean.length > 70 ? clean.slice(0, 70) + '…' : clean;
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

  const bookingStatus = useMemo(() => {
    return getBookingStatus(
      checkInDate ? new Date(checkInDate) : undefined,
      checkOutDate ? new Date(checkOutDate) : undefined,
    );
  }, [checkInDate, checkOutDate]);

  const initials = getInitials(guest.name || 'Guest');
  const hasPropertyImage = !!property?.image;
  const hasGuestAvatar = !!guest?.avatar;

  return (
    <PremiumPressable
      onPress={onPress}
      scaleTo={0.98}
      hapticFeedback="light"
      accessibilityLabel={`${guest.name || 'Unknown Guest'}${isUnread ? ', unread' : ''}. ${lastMessagePreview}. ${bookingStatus.label}${dateRange ? `, ${dateRange}` : ''}. ${property?.name || ''}`}
      accessibilityHint="Opens conversation"
      style={({ pressed }) => [
        styles.row,
        isSelected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {/* ── Thumbnail: property photo with guest avatar overlay ── */}
      <View style={styles.thumbnailContainer}>
        {hasPropertyImage ? (
          <Image source={{ uri: property.image }} style={styles.propertyPhoto} resizeMode="cover" />
        ) : (
          <View style={[styles.propertyPhoto, styles.propertyPhotoFallback, { backgroundColor: getAvatarColor(property?.name || 'P') }]}>
            <Text style={styles.propertyInitial}>{(property?.name || 'P')[0].toUpperCase()}</Text>
          </View>
        )}
        {hasGuestAvatar ? (
          <Image source={{ uri: guest.avatar }} style={styles.guestAvatarOverlay} resizeMode="cover" />
        ) : (
          <View style={[styles.guestAvatarOverlay, styles.guestAvatarFallback, { backgroundColor: getAvatarColor(guest.name || 'G') }]}>
            <Text style={styles.guestAvatarText}>{initials[0]}</Text>
          </View>
        )}
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {/* Line 1: Guest name + timestamp */}
        <View style={styles.topRow}>
          <Text style={[styles.guestName, isUnread && styles.guestNameUnread]} numberOfLines={1}>
            {guest.name || 'Unknown Guest'}
          </Text>
          {timestamp ? (
            <Text style={[styles.timestamp, isUnread && styles.timestampUnread]}>{timestamp}</Text>
          ) : null}
        </View>

        {/* Line 2: Message preview */}
        <Text style={[styles.messagePreview, isUnread && styles.messagePreviewUnread]} numberOfLines={1}>
          {lastMessagePreview}
        </Text>

        {/* Line 3: ● Confirmed · May 8 – 11 · Riverview */}
        <View style={styles.bottomRow}>
          {bookingStatus.label ? (
            <>
              <View style={[styles.statusDot, bookingStatus.isActive ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={styles.bottomText}>{bookingStatus.label}</Text>
            </>
          ) : null}
          {bookingStatus.label && dateRange ? <Text style={styles.dotSeparator}>·</Text> : null}
          {dateRange ? <Text style={styles.bottomText}>{dateRange}</Text> : null}
          {(bookingStatus.label || dateRange) && property?.name ? <Text style={styles.dotSeparator}>·</Text> : null}
          <Text style={styles.bottomText} numberOfLines={1}>{property?.name || ''}</Text>
        </View>
      </View>
    </PremiumPressable>
  );
});

// ───────────────────────────────────────────────────────────────
// Styles — Airbnb Messages inbox layout
// ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  selected: { backgroundColor: '#F8F8F8' },
  pressed: { backgroundColor: '#F5F5F5' },

  // ── Property photo + guest avatar overlay ──
  thumbnailContainer: {
    width: 56,
    height: 56,
    marginRight: 12,
  },
  propertyPhoto: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  propertyPhotoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyInitial: {
    fontSize: 22,
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  guestAvatarOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  guestAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestAvatarText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
  },

  // ── Content ──
  content: {
    flex: 1,
    overflow: 'hidden',
  },

  // ── Line 1 ──
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  guestName: {
    fontSize: 16,
    lineHeight: 21,
    fontFamily: typography.fontFamily.regular,
    color: '#222222',
    flex: 1,
    marginRight: 8,
  },
  guestNameUnread: {
    fontFamily: typography.fontFamily.semibold,
    color: '#000000',
  },
  timestamp: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: typography.fontFamily.regular,
    color: '#717171',
    flexShrink: 0,
    minWidth: 70,
    textAlign: 'right',
  },
  timestampUnread: {
    color: '#222222',
  },

  // ── Line 2 ──
  messagePreview: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: typography.fontFamily.regular,
    color: '#717171',
    marginBottom: 4,
  },
  messagePreviewUnread: {
    color: '#222222',
    fontFamily: typography.fontFamily.medium,
  },

  // ── Line 3 ──
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#00A699',
  },
  statusDotInactive: {
    backgroundColor: '#B0B0B0',
  },
  bottomText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.regular,
    color: '#717171',
    flexShrink: 1,
  },
  dotSeparator: {
    fontSize: 12,
    color: '#DDDDDD',
    marginHorizontal: 5,
  },
});
