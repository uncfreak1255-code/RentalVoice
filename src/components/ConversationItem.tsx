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

// Determine the status label text shown ABOVE the guest name
function getStatusLabel(conversation: Conversation): { label: string; color: string } | null {
  if (conversation.unreadCount > 0 && conversation.lastMessage?.sender !== 'host') {
    return { label: 'NEW', color: '#DC2626' };
  }
  if (conversation.lastMessage?.sender === 'host') {
    return { label: 'REPLIED', color: '#94A3B8' };
  }
  return null;
}

// Determine inline intent tags shown next to the guest name
function getInlineTags(conversation: Conversation) {
  const tags: { id: string; label: string; bg: string; color: string }[] = [];
  const content = conversation.lastMessage?.content?.toLowerCase() || '';

  if (content.includes('thank')) {
    tags.push({ id: 'thanks', label: 'Thanks', bg: '#DCFCE7', color: '#16A34A' });
  }
  if (
    content.includes('?') ||
    content.includes('how') ||
    content.includes('what') ||
    content.includes('where') ||
    content.includes('can i') ||
    content.includes('would it be possible') ||
    content.includes('is it possible')
  ) {
    tags.push({ id: 'question', label: 'Question', bg: '#DBEAFE', color: '#2563EB' });
  }

  return tags;
}

// Check for warning indicator (e.g. unanswered question from guest)
function hasWarning(conversation: Conversation): boolean {
  if (!conversation.lastMessage) return false;
  const content = conversation.lastMessage.content?.toLowerCase() || '';
  const isFromGuest = conversation.lastMessage.sender !== 'host';
  const isQuestion =
    content.includes('?') ||
    content.includes('would it be possible') ||
    content.includes('can we') ||
    content.includes('can i');
  return isFromGuest && isQuestion && (conversation.unreadCount === 0);
}

// Lightweight language detection from message content
const LANGUAGE_PATTERNS: { lang: string; flag: string; patterns: RegExp[] }[] = [
  { lang: 'ES', flag: '🇪🇸', patterns: [/\b(hola|gracias|buenos?\s+d[ií]as|por\s+favor|puede|tiene|cuándo|dónde|cómo|noche|llegamos|salida)\b/i] },
  { lang: 'FR', flag: '🇫🇷', patterns: [/\b(bonjour|merci|s'il\s+vous\s+pla[iî]t|bienvenue|comment|quand|nous|arrivons|chambre|maison)\b/i] },
  { lang: 'PT', flag: '🇧🇷', patterns: [/\b(olá|obrigad[oa]|bom\s+dia|por\s+favor|quando|como|chegamos|noite|casa)\b/i] },
  { lang: 'DE', flag: '🇩🇪', patterns: [/\b(hallo|danke|bitte|guten\s+(tag|morgen|abend)|wann|wie|können|ankunft|abreise)\b/i] },
  { lang: 'IT', flag: '🇮🇹', patterns: [/\b(ciao|grazie|buongiorno|buonasera|per\s+favore|quando|come|arriviamo|notte)\b/i] },
  { lang: 'JA', flag: '🇯🇵', patterns: [/[\u3040-\u309F\u30A0-\u30FF]/] },
  { lang: 'ZH', flag: '🇨🇳', patterns: [/[\u4E00-\u9FFF]/] },
  { lang: 'KO', flag: '🇰🇷', patterns: [/[\uAC00-\uD7AF]/] },
  { lang: 'AR', flag: '🇸🇦', patterns: [/[\u0600-\u06FF]/] },
  { lang: 'RU', flag: '🇷🇺', patterns: [/[\u0400-\u04FF]/] },
];

function detectLanguage(text: string): { lang: string; flag: string } | null {
  if (!text || text.length < 10) return null;
  for (const { lang, flag, patterns } of LANGUAGE_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return { lang, flag };
  }
  return null;
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
    const truncated = clean.length > 60 ? clean.slice(0, 60) + '…' : clean;
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

  const statusLabel = useMemo(() => getStatusLabel(conversation), [conversation]);
  const inlineTags = useMemo(() => getInlineTags(conversation), [conversation]);
  const showWarning = useMemo(() => hasWarning(conversation), [conversation]);

  const initials = getInitials(guest.name || 'Guest');
  const avatarBg = useMemo(() => getAvatarColor(guest.name || 'Guest'), [guest.name]);
  const hasGuestAvatar = !!guest?.avatar;

  // Detect non-English language from last guest message
  const detectedLang = useMemo(() => {
    if (!lastMessage?.content || lastSender === 'host') return null;
    return detectLanguage(lastMessage.content);
  }, [lastMessage, lastSender]);

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
      {/* ── Avatar ── */}
      <View style={styles.avatarContainer}>
        {hasGuestAvatar ? (
          <Image source={{ uri: guest.avatar }} style={styles.avatar} resizeMode="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {/* Row 1: Status label (NEW / REPLIED) */}
        {statusLabel && (
          <Text style={[styles.statusLabel, { color: statusLabel.color }]}>
            {statusLabel.label}
          </Text>
        )}

        {/* Row 2: Guest name + inline tags + timestamp */}
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
            {showWarning && (
              <Text style={styles.warningIcon}>⚠</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {detectedLang && (
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{detectedLang.flag} {detectedLang.lang}</Text>
              </View>
            )}
            {timestamp ? (
              <Text style={styles.timestamp}>{timestamp}</Text>
            ) : null}
          </View>
        </View>

        {/* Row 3: Unread dot + message preview */}
        <View style={styles.messageRow}>
          {isUnread && <View style={styles.unreadDot} />}
          <Text
            style={[styles.messagePreview, isUnread && styles.messagePreviewUnread]}
            numberOfLines={1}
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  selected: { backgroundColor: '#F8FAFB' },
  pressed: { backgroundColor: '#F5F7F8' },

  // ── Avatar ──
  avatarContainer: {
    width: 44,
    height: 44,
    marginRight: 12,
    marginTop: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ── Content ──
  content: {
    flex: 1,
    overflow: 'hidden',
  },

  // ── Row 1: Status label ──
  statusLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: 0.5,
    marginBottom: 1,
  },

  // ── Row 2: Name + tags + time ──
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  nameAndTags: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  guestName: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    color: '#0F172A',
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
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
  },
  warningIcon: {
    fontSize: 14,
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#94A3B8',
    flexShrink: 0,
  },

  // ── Row 3: Unread dot + message ──
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
    flexShrink: 0,
  },
  messagePreview: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: '#64748B',
    flex: 1,
  },
  messagePreviewUnread: {
    color: '#0F172A',
    fontFamily: typography.fontFamily.medium,
  },

  // ── Row 4: Property info ──
  propertyInfo: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: '#14B8A6',
  },

  // ── Language badge ──
  langBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  langBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
    color: '#7C3AED',
    letterSpacing: 0.3,
  },
});
