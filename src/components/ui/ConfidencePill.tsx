import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography, radius, spacing } from '@/lib/design-tokens';

interface ConfidencePillProps {
  value: number;
  size?: 'sm' | 'md';
}

type Tier = 'high' | 'mid' | 'low';

const TIER_STYLES: Record<Tier, { bg: string; fg: string; label: string }> = {
  high: { bg: colors.success.soft, fg: colors.success.DEFAULT, label: 'confident' },
  mid: { bg: colors.warning.soft, fg: '#A16207', label: 'confidence' },
  low: { bg: colors.danger.soft, fg: '#B91C1C', label: 'confidence' },
};

function tierFor(v: number): Tier {
  if (v >= 85) return 'high';
  if (v >= 65) return 'mid';
  return 'low';
}

export function ConfidencePill({ value, size = 'md' }: ConfidencePillProps) {
  const tier = tierFor(value);
  const s = TIER_STYLES[tier];
  const isSm = size === 'sm';
  const circ = 2 * Math.PI * 4;

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: s.bg,
          paddingHorizontal: isSm ? spacing['2'] : spacing['2.5'],
          paddingVertical: isSm ? 2 : spacing['1'],
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${value} percent confidence`}
    >
      <Svg width={10} height={10} viewBox="0 0 10 10">
        <Circle cx="5" cy="5" r="4" fill="none" stroke={s.fg} strokeOpacity={0.25} strokeWidth={1.5} />
        <Circle
          cx="5"
          cy="5"
          r="4"
          fill="none"
          stroke={s.fg}
          strokeWidth={1.5}
          strokeDasharray={`${(value / 100) * circ} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 5 5)"
        />
      </Svg>
      <Text style={[styles.text, { color: s.fg, fontSize: isSm ? 11 : 12.5 }]}>
        {value}% {s.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: -0.1,
  },
});
