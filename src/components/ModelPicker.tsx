// Model Picker — simplified to a compact "⚡ AI" badge
// No model selection needed — the app uses Gemini Flash by default

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { colors, typography } from '@/lib/design-tokens';
import { getUsageStats } from '@/lib/ai-usage-limiter';

interface ModelPickerProps {
  compact?: boolean;
}

export function ModelPicker({ compact = true }: ModelPickerProps) {
  const [draftsToday, setDraftsToday] = useState<number>(0);
  const [dailyLimit, setDailyLimit] = useState<number>(50);

  useEffect(() => {
    getUsageStats().then((stats) => {
      setDraftsToday(stats.draftsToday);
      setDailyLimit(stats.dailyLimit);
    }).catch(console.error);
  }, []);

  if (!compact) return null;

  const isNearLimit = draftsToday >= dailyLimit * 0.8;

  return (
    <View style={styles.badge}>
      <Zap
        size={12}
        color={isNearLimit ? '#F59E0B' : colors.primary.DEFAULT}
        fill={isNearLimit ? '#F59E0B' : colors.primary.DEFAULT}
      />
      <Text style={[styles.badgeText, isNearLimit && { color: '#F59E0B' }]}>
        {draftsToday}/{dailyLimit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary.DEFAULT,
  },
});
