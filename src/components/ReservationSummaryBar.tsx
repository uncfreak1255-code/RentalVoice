import React, { useMemo, memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react-native';
import type { Conversation } from '@/lib/store';

interface ReservationSummaryBarProps {
  conversation: Conversation;
  onSeeDetails: () => void;
}

// Format date range like Hostaway: "Jun 22 - Jun 28"
function formatHostawayDateRange(checkIn?: Date, checkOut?: Date): string {
  if (!checkIn && !checkOut) return '';
  const formatDate = (d: Date) => format(new Date(d), 'MMM d');
  if (checkIn && checkOut) {
    return `${formatDate(checkIn)} - ${formatDate(checkOut)}`;
  }
  if (checkIn) return `From ${formatDate(checkIn)}`;
  if (checkOut) return `Until ${formatDate(checkOut)}`;
  return '';
}

export const ReservationSummaryBar = memo(function ReservationSummaryBar({
  conversation,
  onSeeDetails,
}: ReservationSummaryBarProps) {
  const { property, checkInDate, checkOutDate, numberOfGuests } = conversation;

  // Memoize the formatted date string
  const formattedDates = useMemo(
    () => formatHostawayDateRange(checkInDate, checkOutDate),
    [checkInDate, checkOutDate]
  );

  // Check if we have reservation data to show
  const hasReservationData = numberOfGuests || checkInDate || checkOutDate;

  // If no reservation linked, show placeholder or hide
  if (!hasReservationData) {
    return (
      <View
        style={{
          backgroundColor: '#00695C',
          paddingHorizontal: 16,
          paddingVertical: 14,
          marginTop: 8,
          borderRadius: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#FFFFFF',
              }}
              numberOfLines={1}
            >
              Direct Message
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: 2,
              }}
            >
              No reservation linked
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Build the guest + dates string
  const guestText = numberOfGuests
    ? `${numberOfGuests} guest${numberOfGuests !== 1 ? 's' : ''}`
    : '';
  const separator = guestText && formattedDates ? ' · ' : '';
  const subtitleText = `${guestText}${separator}${formattedDates}`;

  return (
    <View
      style={{
        backgroundColor: '#00695C',
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginTop: 8,
        borderRadius: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left side: Listing name + guest info */}
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: '#FFFFFF',
            }}
            numberOfLines={1}
          >
            {property.name}
          </Text>
          {subtitleText ? (
            <Text
              style={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {subtitleText}
            </Text>
          ) : null}
        </View>

        {/* Right side: See details button */}
        <Pressable
          onPress={onSeeDetails}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#0288D1',
            borderRadius: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
          })}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: '#FFFFFF',
            }}
          >
            See details
          </Text>
          <ChevronRight size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </Pressable>
      </View>
    </View>
  );
});
