import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Cpu } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import { features } from '@/lib/config';

interface AIProviderSettingsScreenProps {
  onBack: () => void;
  /** When true, strips SafeAreaView for use inside a bottom sheet. */
  embedded?: boolean;
}

export function AIProviderSettingsScreen({ onBack, embedded }: AIProviderSettingsScreenProps) {
  const Container = embedded ? View : SafeAreaView;
  const title = features.serverProxiedAI ? 'Managed AI' : 'AI Routing';
  const body = features.serverProxiedAI
    ? 'Rental Voice now manages model routing for commercial workspaces. Provider selection and API key management are no longer part of the active in-app flow.'
    : 'Manual provider key management is no longer part of the main app flow. Personal mode continues to use your current local AI path without exposing the old provider-management screen.';

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.bg.elevated, colors.bg.subtle]} style={styles.gradient} />
      <Container style={styles.safe}>
        <Animated.View entering={FadeIn.duration(250)} style={styles.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.spacer} />
        </Animated.View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.card}>
            <View style={styles.iconWrap}>
              <Shield size={20} color={colors.primary.DEFAULT} />
            </View>
            <Text style={styles.cardTitle}>Legacy screen retained for compatibility</Text>
            <Text style={styles.cardBody}>{body}</Text>

            <View style={styles.points}>
              <View style={styles.pointRow}>
                <Cpu size={16} color={colors.primary.DEFAULT} />
                <Text style={styles.pointText}>Current settings focus on PMS connection, billing, memory, and learning.</Text>
              </View>
              <View style={styles.pointRow}>
                <Shield size={16} color={colors.primary.DEFAULT} />
                <Text style={styles.pointText}>This route exists only so older deep links and legacy navigation targets fail safely.</Text>
              </View>
            </View>

            <Pressable onPress={onBack} style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}>
              <Text style={styles.primaryBtnText}>Back to Settings</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['2'],
    paddingBottom: spacing['3'],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.elevated,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  spacer: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['4'],
  },
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    padding: spacing['5'],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing['4'],
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.muted,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
  },
  points: {
    gap: spacing['3'],
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['3'],
  },
  pointText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.muted,
  },
  primaryBtn: {
    marginTop: spacing['2'],
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3'],
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: typography.fontFamily.semibold,
  },
});
