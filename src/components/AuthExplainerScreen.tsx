import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Eye, MessageSquare, Shield, Sparkles } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/lib/design-tokens';

interface AuthExplainerScreenProps {
  onContinue: () => void;
  onTryDemo?: () => void;
}

const EXPLAINER_POINTS = [
  'Create your Rental Voice account first so your voice model belongs to you.',
  'Connect Hostaway next and we will start importing your past guest replies immediately.',
  'Drafts work while the system is learning. Autopilot stays off until your voice model is ready.',
];

export function AuthExplainerScreen({ onContinue, onTryDemo }: AuthExplainerScreenProps) {
  return (
    <View style={styles.root}>
      <View style={styles.heroIcon}>
        <MessageSquare size={36} color={colors.text.inverse} />
      </View>
      <Text style={styles.title}>Your account comes first</Text>
      <Text style={styles.subtitle}>
        Rental Voice needs a real account before it connects your PMS, learns your tone, and keeps your voice model across devices.
      </Text>

      <View style={styles.card}>
        {EXPLAINER_POINTS.map((point, index) => {
          const Icon = index === 0 ? Shield : index === 1 ? Sparkles : MessageSquare;
          return (
            <View key={point} style={styles.pointRow}>
              <View style={styles.pointIcon}>
                <Icon size={18} color={colors.primary.DEFAULT} />
              </View>
              <Text style={styles.pointText}>{point}</Text>
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={onContinue}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        testID="auth-explainer-continue"
      >
        <Text style={styles.primaryButtonText}>Continue with Email</Text>
        <ArrowRight size={18} color={colors.text.inverse} />
      </Pressable>

      {onTryDemo && (
        <Pressable
          onPress={onTryDemo}
          style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}
          testID="auth-explainer-try-demo"
        >
          <Eye size={16} color={colors.text.muted} />
          <Text style={styles.demoButtonText}>Try Demo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: spacing['6'],
    justifyContent: 'center',
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.accent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing['5'],
  },
  title: {
    color: colors.text.primary,
    fontSize: 30,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: spacing['3'],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing['5'],
    marginTop: spacing['8'],
    gap: spacing['4'],
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.bg.hover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  pointText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: spacing['8'],
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: radius.full,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
  },
  demoButton: {
    marginTop: spacing['3'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    minHeight: 48,
  },
  demoButtonText: {
    color: colors.text.muted,
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
  },
  pressed: {
    opacity: 0.88,
  },
});
