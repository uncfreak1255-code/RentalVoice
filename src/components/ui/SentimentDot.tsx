import React from 'react';
import { View } from 'react-native';
import { colors } from '@/lib/design-tokens';

export type SentimentLevel = 'urgent' | 'negative' | 'neutral' | 'positive';

interface SentimentDotProps {
  level: SentimentLevel;
  size?: number;
}

const DOT_STYLES: Record<Exclude<SentimentLevel, 'neutral'>, { color: string; label: string }> = {
  urgent: { color: colors.danger.DEFAULT, label: 'Urgent' },
  negative: { color: colors.accent.DEFAULT, label: 'Needs attention' },
  positive: { color: colors.success.DEFAULT, label: 'Happy' },
};

export function SentimentDot({ level, size = 8 }: SentimentDotProps) {
  if (level === 'neutral') return null;
  const s = DOT_STYLES[level];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: s.color,
      }}
      accessibilityLabel={s.label}
    />
  );
}
