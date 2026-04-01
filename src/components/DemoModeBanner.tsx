/**
 * Demo Mode Banner
 *
 * src/components/DemoModeBanner.tsx
 * Purpose: Persistent banner shown on every screen during Apple reviewer demo mode.
 *          Clearly communicates demo state and provides one-tap exit.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Eye, X } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';

interface DemoModeBannerProps {
  onExitDemo: () => void;
}

export function DemoModeBanner({ onExitDemo }: DemoModeBannerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Eye size={14} color={colors.accent.DEFAULT} />
        <Text style={styles.label}>DEMO MODE</Text>
        <Text style={styles.separator}>{'\u2014'}</Text>
        <Text style={styles.description} numberOfLines={1}>
          Exploring Rental Voice
        </Text>
      </View>
      <Pressable
        onPress={onExitDemo}
        hitSlop={8}
        style={({ pressed }) => [styles.exitButton, pressed && styles.exitPressed]}
        accessibilityLabel="Exit demo mode"
        testID="demo-banner-exit"
      >
        <Text style={styles.exitText}>Exit Demo</Text>
        <X size={12} color={colors.accent.DEFAULT} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.accent.muted,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent.soft,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing['1.5'],
  },
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    color: colors.accent.DEFAULT,
    letterSpacing: 0.8,
  },
  separator: {
    color: colors.text.disabled,
    fontSize: 11,
  },
  description: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.soft,
    borderRadius: radius.md,
    paddingVertical: spacing['1'],
    paddingHorizontal: spacing['2.5'],
    gap: 4,
    marginLeft: spacing['2'],
  },
  exitPressed: {
    opacity: 0.7,
  },
  exitText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 11,
    color: colors.accent.DEFAULT,
  },
});
