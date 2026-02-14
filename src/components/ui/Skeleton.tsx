import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@/lib/design-tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

/** Single animated skeleton bar */
export function Skeleton({ width = '100%', height = 16, borderRadius = radius.sm, style }: SkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.6]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.bg.hover,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Skeleton that mimics a conversation row */
export function ConversationSkeleton() {
  return (
    <View style={skeletonStyles.conversationRow}>
      {/* Avatar */}
      <Skeleton width={48} height={48} borderRadius={24} />

      {/* Content */}
      <View style={skeletonStyles.content}>
        <View style={skeletonStyles.topRow}>
          <Skeleton width={120} height={14} />
          <Skeleton width={50} height={12} />
        </View>
        <Skeleton width="85%" height={12} style={{ marginTop: 6 }} />
        <Skeleton width="60%" height={12} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

/** Skeleton that mimics a full inbox screen */
export function InboxSkeleton() {
  return (
    <View style={skeletonStyles.inbox}>
      {/* Filter bar */}
      <View style={skeletonStyles.filterBar}>
        {[60, 80, 70, 55, 75].map((w, i) => (
          <Skeleton key={i} width={w} height={32} borderRadius={16} style={{ marginRight: 8 }} />
        ))}
      </View>

      {/* Conversation rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <ConversationSkeleton key={i} />
      ))}
    </View>
  );
}

/** Skeleton for a chat message */
export function MessageSkeleton({ incoming = true }: { incoming?: boolean }) {
  return (
    <View style={[skeletonStyles.messageRow, !incoming && { justifyContent: 'flex-end' }]}>
      <Skeleton
        width={incoming ? '70%' : '60%'}
        height={incoming ? 56 : 40}
        borderRadius={16}
      />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    gap: spacing['3'],
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inbox: {
    flex: 1,
    paddingTop: spacing['2'],
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  messageRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['1'],
  },
});
