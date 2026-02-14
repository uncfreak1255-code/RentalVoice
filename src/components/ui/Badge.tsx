import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radius } from '@/lib/design-tokens';

type BadgeVariant = 'primary' | 'accent' | 'danger' | 'success' | 'warning' | 'muted' | 'count';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  /** Filled style (true) vs outlined (false) */
  solid?: boolean;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.primary.muted, text: colors.primary.DEFAULT },
  accent: { bg: colors.accent.muted, text: colors.accent.DEFAULT },
  danger: { bg: colors.danger.muted, text: colors.danger.DEFAULT },
  success: { bg: colors.success.muted, text: colors.success.DEFAULT },
  warning: { bg: colors.warning.muted, text: colors.warning.DEFAULT },
  muted: { bg: colors.bg.hover, text: colors.text.muted },
  count: { bg: colors.primary.DEFAULT, text: '#FFFFFF' },
};

export function Badge({ label, variant = 'muted', size = 'sm', solid = false }: BadgeProps) {
  const scheme = variantColors[variant];

  return (
    <View
      style={[
        styles.container,
        size === 'sm' ? styles.sm : styles.md,
        solid
          ? { backgroundColor: scheme.text }
          : { backgroundColor: scheme.bg },
      ]}
    >
      <Text
        style={[
          styles.label,
          size === 'sm' ? styles.labelSm : styles.labelMd,
          { color: solid ? '#FFFFFF' : scheme.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** Small numeric count badge (for unread counts, etc.) */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);

  return (
    <View style={styles.countContainer}>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    minHeight: 20,
  },
  md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 26,
  },
  label: {
    fontFamily: typography.fontFamily.semibold,
  },
  labelSm: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  labelMd: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  // Count badge
  countContainer: {
    backgroundColor: colors.danger.DEFAULT,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
  },
});
