import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/lib/design-tokens';

interface SectionHeaderProps {
  title: string;
  /** Optional right-side action button */
  actionLabel?: string;
  onAction?: () => void;
  /** Additional count to display next to title */
  count?: number;
}

export function SectionHeader({ title, actionLabel, onAction, count }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {count !== undefined && count > 0 && (
          <View style={styles.countBubble}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>

      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.action,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
  },
  title: {
    ...typography.styles.overline,
    color: colors.text.muted,
  },
  countBubble: {
    backgroundColor: colors.primary.muted,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary.DEFAULT,
  },
  action: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  actionText: {
    ...typography.styles.label,
    color: colors.primary.DEFAULT,
  },
});
