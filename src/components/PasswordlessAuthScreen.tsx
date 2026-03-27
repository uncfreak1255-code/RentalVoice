import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowRight, ChevronLeft, Mail, Shield } from 'lucide-react-native';
import {
  requestEmailCode,
  verifyEmailCode,
  type PasswordlessAuthResponseData,
} from '@/lib/api-client';
import { colors, radius, spacing, typography } from '@/lib/design-tokens';

interface PasswordlessAuthScreenProps {
  onAuthenticated: (session: PasswordlessAuthResponseData) => void;
  onBack?: () => void;
}

export function PasswordlessAuthScreen({
  onAuthenticated,
  onBack,
}: PasswordlessAuthScreenProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [codeSent, setCodeSent] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  const trimmedCode = code.trim();

  const handleSendCode = async () => {
    if (!trimmedEmail || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await requestEmailCode(trimmedEmail, trimmedName || undefined);
      setCodeSent(true);
    } catch (err) {
      console.error('[PasswordlessAuthScreen] Failed to request code:', err);
      setError('We could not send your login code. Check the email and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!trimmedEmail || !trimmedCode || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const session = await verifyEmailCode(trimmedEmail, trimmedCode);
      onAuthenticated(session);
    } catch (err) {
      console.error('[PasswordlessAuthScreen] Failed to verify code:', err);
      setError('That code did not work. Check the email and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backButton} testID="passwordless-back">
          <ChevronLeft size={18} color={colors.text.muted} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      ) : null}

      <View style={styles.heroIcon}>
        <Mail size={32} color={colors.primary.DEFAULT} />
      </View>
      <Text style={styles.title}>Sign in with email</Text>
      <Text style={styles.subtitle}>
        We will send a one-time code to your inbox. No password to create or forget.
      </Text>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Optional"
          placeholderTextColor={colors.text.disabled}
          style={styles.input}
          autoCapitalize="words"
          testID="passwordless-name-input"
        />

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="host@example.com"
          placeholderTextColor={colors.text.disabled}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          testID="passwordless-email-input"
        />

        {codeSent ? (
          <>
            <Text style={styles.codeTitle}>Enter the 6-digit code</Text>
            <Text style={styles.codeSubtitle}>
              We sent a one-time code to {trimmedEmail}. Enter it here to finish signing in.
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={colors.text.disabled}
              style={styles.input}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              testID="passwordless-code-input"
            />
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.infoRow}>
          <Shield size={16} color={colors.primary.DEFAULT} />
          <Text style={styles.infoText}>
            Drafts will work while your voice model is learning. Autopilot stays off until readiness is proven.
          </Text>
        </View>
      </View>

      {!codeSent ? (
        <Pressable
          onPress={handleSendCode}
          disabled={!trimmedEmail || isSubmitting}
          style={({ pressed }) => [
            styles.primaryButton,
            (!trimmedEmail || isSubmitting) && styles.primaryButtonDisabled,
            pressed && trimmedEmail && !isSubmitting && styles.pressed,
          ]}
          testID="passwordless-send-code"
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? 'Sending Code...' : 'Send Login Code'}
          </Text>
          <ArrowRight size={18} color={colors.text.inverse} />
        </Pressable>
      ) : (
        <Pressable
          onPress={handleVerifyCode}
          disabled={!trimmedCode || isSubmitting}
          style={({ pressed }) => [
            styles.primaryButton,
            (!trimmedCode || isSubmitting) && styles.primaryButtonDisabled,
            pressed && trimmedCode && !isSubmitting && styles.pressed,
          ]}
          testID="passwordless-verify-code"
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? 'Verifying...' : 'Verify Code'}
          </Text>
          <ArrowRight size={18} color={colors.text.inverse} />
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing['6'],
  },
  backButtonText: {
    color: colors.text.muted,
    fontSize: 14,
    marginLeft: spacing['2'],
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing['4'],
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
  },
  subtitle: {
    color: colors.text.muted,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing['3'],
    marginBottom: spacing['6'],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing['5'],
  },
  inputLabel: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing['2'],
  },
  input: {
    backgroundColor: colors.bg.hover,
    borderRadius: radius.md,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['4'],
    minHeight: 52,
    color: colors.text.primary,
    fontSize: 16,
    marginBottom: spacing['4'],
  },
  codeTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    marginBottom: spacing['2'],
  },
  codeSubtitle: {
    color: colors.text.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing['4'],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2'],
  },
  infoText: {
    flex: 1,
    color: colors.text.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger.DEFAULT,
    fontSize: 14,
    marginBottom: spacing['4'],
  },
  primaryButton: {
    marginTop: spacing['6'],
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: radius.full,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
  },
  pressed: {
    opacity: 0.88,
  },
});
