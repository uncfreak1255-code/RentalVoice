import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { User } from 'lucide-react-native';
import { OTALogo } from './OTALogo';

interface GuestAvatarWithOTAProps {
  guestName: string;
  guestAvatar?: string;
  platform?: 'airbnb' | 'booking' | 'vrbo' | 'direct';
  size?: number;
  hasUnread?: boolean;
  cardBackgroundColor?: string;
}

/**
 * Guest avatar with OTA/channel logo overlay in the bottom-right corner.
 * Shows guest profile photo if available, otherwise displays:
 * - Guest's initial with OTA logo overlay
 * - Or just the OTA logo if no guest name
 */
export function GuestAvatarWithOTA({
  guestName,
  guestAvatar,
  platform = 'direct',
  size = 56,
  hasUnread = false,
  cardBackgroundColor = '#FFFFFF',
}: GuestAvatarWithOTAProps) {
  const logoSize = Math.max(20, Math.min(26, size * 0.4)); // 20-26px for OTA logo (larger)

  // Get initials from guest name
  const getInitials = (name: string): string => {
    if (!name || name === 'Unknown Guest') return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  // Get a color based on the guest name for the fallback avatar background
  const getAvatarColor = (name: string): string => {
    if (!name) return '#E5E7EB';
    const colors = [
      '#6366F1', // Indigo
      '#8B5CF6', // Violet
      '#A855F7', // Purple
      '#EC4899', // Pink
      '#F43F5E', // Rose
      '#EF4444', // Red
      '#F97316', // Orange
      '#F59E0B', // Amber
      '#84CC16', // Lime
      '#22C55E', // Green
      '#14B8A6', // Teal
      '#06B6D4', // Cyan
      '#3B82F6', // Blue
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const initials = getInitials(guestName);
  const avatarBgColor = getAvatarColor(guestName);

  return (
    <View style={{ position: 'relative' }}>
      {/* Main Avatar */}
      {guestAvatar ? (
        <Image
          source={{ uri: guestAvatar }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={(e) => console.log('[Avatar] Image load error:', e)}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: avatarBgColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {initials !== '?' ? (
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: size * 0.36,
                fontWeight: '600',
                letterSpacing: 0.3,
              }}
            >
              {initials}
            </Text>
          ) : (
            <User size={size * 0.4} color="#FFFFFF" strokeWidth={2} />
          )}
        </View>
      )}

      {/* OTA Logo Overlay - Bottom Right */}
      <View
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          // Outer ring matches card background for "cutout" effect
          borderWidth: 2,
          borderColor: cardBackgroundColor,
          borderRadius: (logoSize + 4) / 2,
        }}
      >
        <OTALogo platform={platform} size={logoSize} />
      </View>
    </View>
  );
}

/**
 * Smaller version for compact lists or secondary displays
 */
export function GuestAvatarWithOTACompact({
  guestName,
  guestAvatar,
  platform = 'direct',
  hasUnread = false,
}: Omit<GuestAvatarWithOTAProps, 'size' | 'cardBackgroundColor'>) {
  return (
    <GuestAvatarWithOTA
      guestName={guestName}
      guestAvatar={guestAvatar}
      platform={platform}
      size={44}
      hasUnread={hasUnread}
      cardBackgroundColor="#FFFFFF"
    />
  );
}
