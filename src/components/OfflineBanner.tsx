import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { WifiOff, RefreshCw, CloudOff } from 'lucide-react-native';
import { colors, typography, spacing } from '@/lib/design-tokens';

interface OfflineBannerProps {
  isOffline: boolean;
  queueLength: number;
  onRetry?: () => void;
}

/**
 * Floating offline status banner. Shows when device is offline
 * with queued message count and retry button.
 */
export function OfflineBanner({ isOffline, queueLength, onRetry }: OfflineBannerProps) {
  if (!isOffline) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(300).springify()}
      exiting={FadeOutUp.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        paddingHorizontal: spacing['4'],
        paddingTop: spacing['2'],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          borderRadius: 12,
          paddingHorizontal: spacing['4'],
          paddingVertical: spacing['3'],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WifiOff size={16} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1, marginLeft: spacing['3'] }}>
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fontFamily.semibold,
              fontSize: 14,
            }}
          >
            You're Offline
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontFamily: typography.fontFamily.regular,
              fontSize: 12,
              marginTop: 1,
            }}
          >
            {queueLength > 0
              ? `${queueLength} message${queueLength > 1 ? 's' : ''} queued`
              : 'Messages will send when reconnected'}
          </Text>
        </View>

        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <RefreshCw size={14} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Inline offline indicator for individual screens (smaller, less intrusive).
 */
export function OfflineChip({ isOffline }: { isOffline: boolean }) {
  if (!isOffline) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(150)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${colors.status.urgent}20`,
        paddingHorizontal: spacing['3'],
        paddingVertical: spacing['1'],
        borderRadius: 20,
        gap: 4,
        alignSelf: 'center',
        marginBottom: spacing['2'],
      }}
    >
      <CloudOff size={12} color={colors.status.urgent} />
      <Text
        style={{
          color: colors.status.urgent,
          fontFamily: typography.fontFamily.medium,
          fontSize: 11,
        }}
      >
        Offline
      </Text>
    </Animated.View>
  );
}
