import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, getAvatarGradient, typography, radius } from '@/lib/design-tokens';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showOnline?: boolean;
  platformIcon?: 'airbnb' | 'vrbo' | 'booking' | 'direct';
}

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
};

const fontSizeMap = {
  sm: 12,
  md: 14,
  lg: 17,
  xl: 20,
};

const statusDotMap = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
};

export function Avatar({ name, imageUrl, size = 'md', showOnline, platformIcon }: AvatarProps) {
  const dimension = sizeMap[size];
  const fontSize = fontSizeMap[size];
  const statusDot = statusDotMap[size];

  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const gradient = useMemo(() => getAvatarGradient(name), [name]);

  const platformColor = platformIcon ? colors.platform[platformIcon] : null;

  return (
    <View style={{ width: dimension, height: dimension, position: 'relative' }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            },
          ]}
        />
      ) : (
        <LinearGradient
          colors={[gradient[0], gradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            },
          ]}
        >
          <Text
            style={[
              styles.initials,
              {
                fontSize,
                fontFamily: typography.fontFamily.semibold,
              },
            ]}
          >
            {initials}
          </Text>
        </LinearGradient>
      )}

      {/* Online indicator */}
      {showOnline && (
        <View
          style={[
            styles.statusDot,
            {
              width: statusDot,
              height: statusDot,
              borderRadius: statusDot / 2,
              borderWidth: size === 'sm' ? 1.5 : 2,
              bottom: size === 'sm' ? -1 : 0,
              right: size === 'sm' ? -1 : 0,
            },
          ]}
        />
      )}

      {/* Platform badge */}
      {platformColor && size !== 'sm' && (
        <View
          style={[
            styles.platformBadge,
            { backgroundColor: platformColor },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  statusDot: {
    position: 'absolute',
    backgroundColor: colors.status.online,
    borderColor: colors.bg.card,
  },
  platformBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.bg.card,
  },
});
