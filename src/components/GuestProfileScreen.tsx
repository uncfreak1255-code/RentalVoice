/**
 * Guest Profile Screen
 * 
 * 📁 src/components/GuestProfileScreen.tsx
 * Purpose: Detailed guest profile view accessible from chat header
 * Shows: contact info, reservation details, stay history, language, VIP status
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Star,
  Calendar,
  Home,
  MessageSquare,
  Clock,
  User,
  Crown,
} from 'lucide-react-native';
import { format, differenceInDays, isPast, isFuture } from 'date-fns';
import { Avatar } from '@/components/ui/Avatar';
import { colors, typography, spacing, radius, elevation } from '@/lib/design-tokens';
import type { Conversation } from '@/lib/store';
import { useAppStore } from '@/lib/store';
import { LinearGradient } from 'expo-linear-gradient';

interface GuestProfileScreenProps {
  conversation: Conversation;
  onBack: () => void;
}

export function GuestProfileScreen({ conversation, onBack }: GuestProfileScreenProps) {
  const { guest, property, checkInDate, checkOutDate, platform, numberOfGuests, messages } = conversation;
  const conversations = useAppStore((s) => s.conversations);

  // Find all conversations with this guest
  const guestHistory = useMemo(() => {
    return conversations.filter(
      (c) => c.guest.name === guest.name && c.id !== conversation.id
    );
  }, [conversations, guest.name, conversation.id]);

  const totalStays = (guest.previousStays || 0) + 1;
  const totalMessages = messages?.length || 0;

  const stayStatus = useMemo(() => {
    if (!checkInDate || !checkOutDate) return null;
    const now = new Date();
    const checkin = new Date(checkInDate);
    const checkout = new Date(checkOutDate);

    if (isPast(checkout)) return { label: 'Checked Out', color: colors.text.muted };
    if (isPast(checkin) && isFuture(checkout)) return { label: 'Currently Staying', color: colors.success.DEFAULT };
    if (isFuture(checkin)) {
      const daysUntil = differenceInDays(checkin, now);
      return { label: `Arriving in ${daysUntil}d`, color: colors.accent.DEFAULT };
    }
    return null;
  }, [checkInDate, checkOutDate]);

  const nightCount = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    return differenceInDays(new Date(checkOutDate), new Date(checkInDate));
  }, [checkInDate, checkOutDate]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.base }}>
      <LinearGradient
        colors={[colors.bg.elevated, colors.bg.subtle]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={gp.header}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [gp.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={gp.headerTitle}>Guest Profile</Text>
          <View style={{ width: 36 }} />
        </Animated.View>

        <ScrollView contentContainerStyle={{ paddingBottom: spacing['10'] }} showsVerticalScrollIndicator={false}>
          {/* Profile Hero */}
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={gp.heroSection}>
            <Avatar
              name={guest.name}
              imageUrl={guest.avatar}
              size="xl"
              platformIcon={platform}
            />
            <Text style={gp.guestName}>{guest.name}</Text>
            {guest.isVip && (
              <View style={gp.vipBadge}>
                <Crown size={12} color="#F59E0B" />
                <Text style={gp.vipText}>VIP Guest</Text>
              </View>
            )}
            {stayStatus && (
              <View style={[gp.statusBadge, { backgroundColor: `${stayStatus.color}20` }]}>
                <View style={[gp.statusDot, { backgroundColor: stayStatus.color }]} />
                <Text style={[gp.statusText, { color: stayStatus.color }]}>{stayStatus.label}</Text>
              </View>
            )}
          </Animated.View>

          {/* Quick Stats */}
          <Animated.View entering={FadeInDown.duration(300).delay(200)} style={gp.statsRow}>
            <View style={gp.statItem}>
              <Text style={gp.statValue}>{totalStays}</Text>
              <Text style={gp.statLabel}>{totalStays === 1 ? 'Stay' : 'Stays'}</Text>
            </View>
            <View style={gp.statDivider} />
            <View style={gp.statItem}>
              <Text style={gp.statValue}>{nightCount}</Text>
              <Text style={gp.statLabel}>Nights</Text>
            </View>
            <View style={gp.statDivider} />
            <View style={gp.statItem}>
              <Text style={gp.statValue}>{totalMessages}</Text>
              <Text style={gp.statLabel}>Messages</Text>
            </View>
          </Animated.View>

          {/* Contact Info */}
          <Animated.View entering={FadeInDown.duration(300).delay(300)} style={gp.section}>
            <Text style={gp.sectionTitle}>Contact</Text>
            <View style={gp.card}>
              {guest.email && (
                <Pressable
                  onPress={() => Linking.openURL(`mailto:${guest.email}`)}
                  style={({ pressed }) => [gp.contactRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={gp.contactIcon}><Mail size={16} color={colors.primary.DEFAULT} /></View>
                  <Text style={gp.contactText}>{guest.email}</Text>
                </Pressable>
              )}
              {guest.phone && (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${guest.phone}`)}
                  style={({ pressed }) => [gp.contactRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={gp.contactIcon}><Phone size={16} color={colors.success.DEFAULT} /></View>
                  <Text style={gp.contactText}>{guest.phone}</Text>
                </Pressable>
              )}
              {(guest.language || guest.detectedLanguage) && (
                <View style={gp.contactRow}>
                  <View style={gp.contactIcon}><Globe size={16} color={colors.accent.DEFAULT} /></View>
                  <Text style={gp.contactText}>
                    {guest.preferredLanguage || guest.detectedLanguage || guest.language || 'English'}
                  </Text>
                </View>
              )}
              {!guest.email && !guest.phone && !guest.language && (
                <Text style={gp.emptyText}>No contact information available from PMS</Text>
              )}
            </View>
          </Animated.View>

          {/* Reservation Details */}
          <Animated.View entering={FadeInDown.duration(300).delay(400)} style={gp.section}>
            <Text style={gp.sectionTitle}>Current Reservation</Text>
            <View style={gp.card}>
              <View style={gp.detailRow}>
                <Home size={16} color={colors.text.muted} />
                <Text style={gp.detailLabel}>Property</Text>
                <Text style={gp.detailValue} numberOfLines={1}>{property?.name || 'Unknown'}</Text>
              </View>
              {platform && (
                <View style={gp.detailRow}>
                  <Star size={16} color={colors.text.muted} />
                  <Text style={gp.detailLabel}>Platform</Text>
                  <Text style={gp.detailValue}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</Text>
                </View>
              )}
              {checkInDate && (
                <View style={gp.detailRow}>
                  <Calendar size={16} color={colors.text.muted} />
                  <Text style={gp.detailLabel}>Check-in</Text>
                  <Text style={gp.detailValue}>{format(new Date(checkInDate), 'MMM d, yyyy')}</Text>
                </View>
              )}
              {checkOutDate && (
                <View style={gp.detailRow}>
                  <Calendar size={16} color={colors.text.muted} />
                  <Text style={gp.detailLabel}>Check-out</Text>
                  <Text style={gp.detailValue}>{format(new Date(checkOutDate), 'MMM d, yyyy')}</Text>
                </View>
              )}
              {numberOfGuests && (
                <View style={gp.detailRow}>
                  <User size={16} color={colors.text.muted} />
                  <Text style={gp.detailLabel}>Guests</Text>
                  <Text style={gp.detailValue}>{numberOfGuests}</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Previous Stays */}
          {guestHistory.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(500)} style={gp.section}>
              <Text style={gp.sectionTitle}>Previous Stays</Text>
              {guestHistory.map((prev) => (
                <View key={prev.id} style={[gp.card, { marginBottom: spacing['2'] }]}>
                  <View style={gp.detailRow}>
                    <Home size={14} color={colors.text.muted} />
                    <Text style={gp.detailValue} numberOfLines={1}>{prev.property?.name || 'Unknown'}</Text>
                  </View>
                  {prev.checkInDate && prev.checkOutDate && (
                    <View style={[gp.detailRow, { marginTop: spacing['1'] }]}>
                      <Clock size={14} color={colors.text.disabled} />
                      <Text style={{ color: colors.text.muted, fontSize: 13 }}>
                        {format(new Date(prev.checkInDate), 'MMM d')} — {format(new Date(prev.checkOutDate), 'MMM d, yyyy')}
                      </Text>
                    </View>
                  )}
                  <View style={[gp.detailRow, { marginTop: spacing['1'] }]}>
                    <MessageSquare size={14} color={colors.text.disabled} />
                    <Text style={{ color: colors.text.muted, fontSize: 13 }}>
                      {prev.messages?.length || 0} messages
                    </Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const gp = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.bg.hover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing['6'],
  },
  guestName: {
    fontSize: 24,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
    marginTop: spacing['3'],
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B20',
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'],
    borderRadius: radius.full,
    marginTop: spacing['2'],
  },
  vipText: {
    color: '#F59E0B',
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    marginLeft: spacing['1'],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'],
    borderRadius: radius.full,
    marginTop: spacing['2'],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing['1.5'],
  },
  statusText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    marginHorizontal: spacing['4'],
    borderRadius: radius.lg,
    paddingVertical: spacing['4'],
    ...elevation.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.muted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.subtle,
  },
  section: {
    paddingHorizontal: spacing['4'],
    marginTop: spacing['6'],
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing['2'],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing['4'],
    ...elevation.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing['2'],
  },
  contactIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  contactText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing['1.5'],
    gap: spacing['2'],
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.muted,
    width: 80,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.secondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
});
