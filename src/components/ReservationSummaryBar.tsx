import React, { useMemo, memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';
import type { Conversation } from '@/lib/store';

interface ReservationSummaryBarProps {
  conversation: Conversation;
  onSeeDetails: () => void;
}

function formatHostawayDateRange(checkIn?: Date, checkOut?: Date): string {
  if (!checkIn && !checkOut) return '';
  const formatDate = (d: Date) => format(new Date(d), 'MMM d');
  if (checkIn && checkOut) return `${formatDate(checkIn)} - ${formatDate(checkOut)}`;
  if (checkIn) return `From ${formatDate(checkIn)}`;
  if (checkOut) return `Until ${formatDate(checkOut)}`;
  return '';
}

export const ReservationSummaryBar = memo(function ReservationSummaryBar({
  conversation,
  onSeeDetails,
}: ReservationSummaryBarProps) {
  const { property, checkInDate, checkOutDate, numberOfGuests } = conversation;

  const formattedDates = useMemo(
    () => formatHostawayDateRange(checkInDate, checkOutDate),
    [checkInDate, checkOutDate]
  );

  const hasReservationData = numberOfGuests || checkInDate || checkOutDate;

  if (!hasReservationData) {
    return (
      <View style={{
        backgroundColor: colors.primary.DEFAULT,
        paddingHorizontal: spacing['4'],
        paddingVertical: spacing['3'],
        marginTop: spacing['2'],
        borderRadius: radius.lg,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 15,
            fontFamily: typography.fontFamily.semibold,
            color: colors.text.inverse,
          }} numberOfLines={1}>
            Direct Message
          </Text>
          <Text style={{
            fontSize: 13,
            fontFamily: typography.fontFamily.regular,
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: spacing['0.5'],
          }}>
            No reservation linked
          </Text>
        </View>
      </View>
    );
  }

  const guestText = numberOfGuests
    ? `${numberOfGuests} guest${numberOfGuests !== 1 ? 's' : ''}`
    : '';
  const separator = guestText && formattedDates ? ' · ' : '';
  const subtitleText = `${guestText}${separator}${formattedDates}`;

  return (
    <View style={{
      backgroundColor: colors.primary.DEFAULT,
      paddingHorizontal: spacing['4'],
      paddingVertical: spacing['3'],
      marginTop: spacing['2'],
      borderRadius: radius.lg,
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flex: 1, marginRight: spacing['3'] }}>
          <Text style={{
            fontSize: 15,
            fontFamily: typography.fontFamily.semibold,
            color: colors.text.inverse,
          }} numberOfLines={1}>
            {property.name}
          </Text>
          {subtitleText ? (
            <Text style={{
              fontSize: 13,
              fontFamily: typography.fontFamily.regular,
              color: 'rgba(255, 255, 255, 0.7)',
              marginTop: spacing['0.5'],
            }} numberOfLines={1}>
              {subtitleText}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={onSeeDetails}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: radius.md,
            paddingHorizontal: spacing['3'],
            paddingVertical: spacing['1.5'],
          })}
        >
          <Text style={{
            fontSize: 13,
            fontFamily: typography.fontFamily.medium,
            color: colors.text.inverse,
          }}>
            See details
          </Text>
          <ChevronRight size={14} color={colors.text.inverse} style={{ marginLeft: spacing['1'] }} />
        </Pressable>
      </View>
    </View>
  );
});
