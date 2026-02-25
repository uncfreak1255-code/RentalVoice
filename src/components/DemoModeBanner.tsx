/**
 * Demo Mode Banner
 *
 * 📁 src/components/DemoModeBanner.tsx
 * Purpose: Shows a banner when the app is in demo mode (no PMS API key configured).
 *          Clearly communicates to users/reviewers that they're viewing sample data.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Info, X } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';

interface DemoModeBannerProps {
  onDismiss?: () => void;
  onConnectPMS?: () => void;
}

export function DemoModeBanner({ onDismiss, onConnectPMS }: DemoModeBannerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Info size={16} color={colors.primary.DEFAULT} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Demo Mode</Text>
          <Text style={styles.description}>
            You're viewing sample data. Connect your property management system to see real conversations.
          </Text>
        </View>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={8}>
            <X size={16} color={colors.text.muted} />
          </Pressable>
        )}
      </View>
      {onConnectPMS && (
        <Pressable style={styles.connectButton} onPress={onConnectPMS}>
          <Text style={styles.connectButtonText}>Connect PMS</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary.muted,
    borderWidth: 1,
    borderColor: colors.primary.soft,
    borderRadius: radius['xl'],
    marginHorizontal: spacing['4'],
    marginBottom: spacing['2'],
    padding: spacing['3'],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2'],
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
    color: colors.primary.DEFAULT,
    marginBottom: 2,
  },
  description: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  connectButton: {
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: radius['lg'],
    paddingVertical: spacing['1.5'],
    paddingHorizontal: spacing['4'],
    alignSelf: 'flex-start',
    marginTop: spacing['2'],
    marginLeft: spacing['4'] + 16,
  },
  connectButtonText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
