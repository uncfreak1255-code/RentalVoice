import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Shield, User, Mail, Clock, Database,
  RefreshCw, Brain, Stethoscope, LogOut,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '@/lib/design-tokens';
import { SectionHeader, SectionFooter, ValueRow, LinkRow, s } from './ui/SettingsComponents';
import { useAppStore, type FounderSession } from '@/lib/store';
import { APP_MODE } from '@/lib/config';
import {
  getCurrentUser,
  requestEmailCode,
  verifyEmailCode,
  type CurrentUserResponseData,
  type LocalLearningMigrationImportResponse,
  type PasswordlessAuthResponseData,
} from '@/lib/api-client';
import { migrateLocalLearningToVerifiedFounderCommercial } from '@/lib/commercial-migration';

interface FounderAccessScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

export function FounderAccessScreen({ onBack, onNavigate }: FounderAccessScreenProps) {
  const founderSession = useAppStore((s) => s.founderSession);
  const founderSessionLoading = useAppStore((s) => s.founderSessionLoading);
  const restoreFounderSession = useAppStore((s) => s.restoreFounderSession);
  const clearFounderAuthSession = useAppStore((s) => s.clearFounderAuthSession);
  const setFounderAuthSession = useAppStore((s) => s.setFounderAuthSession);
  const setFounderSession = useAppStore((s) => s.setFounderSession);

  const [isRestoring, setIsRestoring] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMigratingLearning, setIsMigratingLearning] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationImportResponse, setMigrationImportResponse] = useState<LocalLearningMigrationImportResponse | null>(null);
  const [verifiedSnapshotId, setVerifiedSnapshotId] = useState<string | null>(null);

  const isSignedIn = !!founderSession;
  const trimmedEmail = email.trim();
  const trimmedCode = code.trim();

  const handleEmailChange = useCallback((nextEmail: string) => {
    setEmail(nextEmail);
    setAuthError(null);
    if (codeRequested) {
      setCodeRequested(false);
      setCode('');
    }
  }, [codeRequested]);

  const handleRestoreSession = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRestoring(true);
    try {
      const session = await restoreFounderSession();
      if (session) {
        Alert.alert('Session Restored', `Founder session restored for ${session.email}`);
      } else {
        Alert.alert('No Session Found', 'No founder session was found in secure storage. Sign in first.');
      }
    } catch (error) {
      console.error('[FounderAccessScreen] Restore failed:', error);
      Alert.alert('Restore Failed', 'Could not restore founder session. Try signing in again.');
    } finally {
      setIsRestoring(false);
    }
  }, [restoreFounderSession]);

  const handleRequestCode = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!trimmedEmail || isRequestingCode) {
      return;
    }

    setIsRequestingCode(true);
    setAuthError(null);
    try {
      await requestEmailCode(trimmedEmail);
      setCodeRequested(true);
      setCode('');
    } catch (error) {
      console.error('[FounderAccessScreen] Failed to request founder code:', error);
      setAuthError('We could not send the code. Check the email and try again.');
    } finally {
      setIsRequestingCode(false);
    }
  }, [isRequestingCode, trimmedEmail]);

  const handleVerifyCode = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!trimmedEmail || !trimmedCode || isVerifyingCode) {
      return;
    }

    setIsVerifyingCode(true);
    setAuthError(null);
    try {
      const authSession: PasswordlessAuthResponseData = await verifyEmailCode(trimmedEmail, trimmedCode);
      const currentUser: CurrentUserResponseData = await getCurrentUser();

      if (currentUser.founderAccess === false) {
        throw new Error('Founder access is not enabled for this account.');
      }

      if (!currentUser.organization?.id) {
        throw new Error('Founder organization was not returned by the server.');
      }

      const validatedAt = new Date().toISOString();
      setFounderAuthSession({
        accountSession: {
          token: authSession.token,
          refreshToken: authSession.refreshToken,
          user: authSession.user,
        },
        founderSession: {
          userId: currentUser.user.id,
          orgId: currentUser.organization.id,
          email: currentUser.user.email,
          accessToken: authSession.token,
          refreshToken: authSession.refreshToken,
          validatedAt,
          migrationState: 'pending',
        },
      });

      setCodeRequested(false);
      setCode('');
      setAuthError(null);
      Alert.alert('Founder Access Ready', `Signed in as ${currentUser.user.email}`);
    } catch (error) {
      console.error('[FounderAccessScreen] Failed to verify founder code:', error);
      await clearFounderAuthSession();
      setAuthError('That code did not work. Check the email and try again.');
    } finally {
      setIsVerifyingCode(false);
    }
  }, [clearFounderAuthSession, isVerifyingCode, setFounderAuthSession, trimmedCode, trimmedEmail]);

  const handleMigrateLearning = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isMigratingLearning) {
      return;
    }
    if (!founderSession) {
      Alert.alert('Sign In Required', 'You must have an active founder session to migrate learning data.');
      return;
    }

    const inProgressSession: FounderSession = {
      ...founderSession,
      migrationState: 'in_progress',
    };

    setFounderSession(inProgressSession);
    setMigrationError(null);
    setMigrationImportResponse(null);
    setVerifiedSnapshotId(null);
    setIsMigratingLearning(true);

    try {
      const result = await migrateLocalLearningToVerifiedFounderCommercial({
        founderEmail: founderSession.email,
        founderUserId: founderSession.userId,
      });

      setFounderSession({
        ...inProgressSession,
        migrationState: 'completed',
      });
      setVerifiedSnapshotId(result.importResponse.snapshotId);
      setMigrationImportResponse(result.importResponse);
    } catch (error) {
      console.error('[FounderAccessScreen] Founder migration failed:', error);
      setFounderSession({
        ...inProgressSession,
        migrationState: 'failed',
      });
      setMigrationError(error instanceof Error ? error.message : 'Founder migration failed.');
    } finally {
      setIsMigratingLearning(false);
    }
  }, [founderSession, isMigratingLearning, setFounderSession]);

  const handleOpenDiagnostics = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigate?.('founderDiagnostics');
  }, [onNavigate]);

  const handleSignOut = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Sign Out Founder',
      'This will clear the founder and account sessions from this device. Your account data on the server is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await clearFounderAuthSession();
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ],
    );
  }, [clearFounderAuthSession]);

  const formatValidatedAt = (iso: string): string => {
    try {
      const date = new Date(iso);
      return date.toLocaleString();
    } catch {
      return iso;
    }
  };

  const migrationStateLabel = (state: FounderSession['migrationState']): string => {
    switch (state) {
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  };

  const migrationStateColor = (state: FounderSession['migrationState']): string => {
    switch (state) {
      case 'completed': return '#10B981';
      case 'in_progress': return '#F59E0B';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const importedCountsSummary = migrationImportResponse
    ? `${migrationImportResponse.imported.hostStyleProfiles} style profiles · ${migrationImportResponse.imported.editPatterns} edit patterns`
    : null;
  const importedDetailSummary = migrationImportResponse
    ? `${migrationImportResponse.stats.learningEntriesReceived} learning entries · ${migrationImportResponse.stats.draftOutcomesReceived} draft outcomes · ${migrationImportResponse.stats.replyDeltasReceived} reply deltas`
    : null;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Founder Access</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {founderSessionLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
              <Text style={styles.loadingText}>Loading session...</Text>
            </View>
          ) : (
            <>
              {/* ── Session Status ── */}
              <SectionHeader title="Founder Session" />
              <View style={s.card}>
                <ValueRow
                  icon={<Shield size={18} color={isSignedIn ? '#10B981' : '#6B7280'} />}
                  label="Status"
                  value={isSignedIn ? 'Signed In' : 'Not Signed In'}
                  valueColor={isSignedIn ? '#10B981' : '#6B7280'}
                />
                {isSignedIn && founderSession && (
                  <>
                    <ValueRow
                      icon={<Mail size={18} color={colors.primary.DEFAULT} />}
                      label="Email"
                      value={founderSession.email}
                    />
                    <ValueRow
                      icon={<User size={18} color={colors.primary.DEFAULT} />}
                      label="User ID"
                      value={founderSession.userId.substring(0, 12) + '...'}
                    />
                    <ValueRow
                      icon={<Clock size={18} color={colors.primary.DEFAULT} />}
                      label="Last Validated"
                      value={formatValidatedAt(founderSession.validatedAt)}
                    />
                  </>
                )}
                <ValueRow
                  icon={<Database size={18} color={colors.primary.DEFAULT} />}
                  label="App Mode"
                  value={APP_MODE === 'personal' ? 'Personal (default)' : 'Commercial'}
                  isLast={!isSignedIn}
                />
                {isSignedIn && (
                  <ValueRow
                    icon={<Shield size={18} color={colors.primary.DEFAULT} />}
                    label="Environment"
                    value="Test (default) · Live available"
                    isLast
                  />
                )}
              </View>
              <SectionFooter
                text={
                  isSignedIn
                    ? 'Founder session active. Personal-mode Hostaway remains the default workflow.'
                    : 'No active founder session. Use email code sign-in or restore from secure storage.'
                }
              />

              {!isSignedIn && (
                <>
                  <SectionHeader title="Founder Sign In" />
                  <View style={s.card}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      value={email}
                      onChangeText={handleEmailChange}
                      placeholder="Email"
                      placeholderTextColor={colors.text.secondary}
                      style={styles.input}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />

                    {codeRequested && (
                      <>
                        <Text style={styles.inputLabel}>Code</Text>
                        <TextInput
                          value={code}
                          onChangeText={setCode}
                          placeholder="6-digit code"
                          placeholderTextColor={colors.text.secondary}
                          style={styles.input}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="number-pad"
                        />
                      </>
                    )}

                    {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

                    {!codeRequested ? (
                      <Pressable
                        onPress={handleRequestCode}
                        disabled={!trimmedEmail || isRequestingCode}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          (!trimmedEmail || isRequestingCode) && styles.primaryButtonDisabled,
                          pressed && trimmedEmail && !isRequestingCode && styles.primaryButtonPressed,
                        ]}
                      >
                        {isRequestingCode ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Send Code</Text>
                        )}
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={handleVerifyCode}
                        disabled={!trimmedCode || isVerifyingCode}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          (!trimmedCode || isVerifyingCode) && styles.primaryButtonDisabled,
                          pressed && trimmedCode && !isVerifyingCode && styles.primaryButtonPressed,
                        ]}
                      >
                        {isVerifyingCode ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Verify Code</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                  <SectionFooter text="We send a one-time code to the founder email. No password is created or stored." />
                </>
              )}

              {/* ── Learning Migration ── */}
              {isSignedIn && founderSession && (
                <>
                  <SectionHeader title="Learning Migration" />
                  <View style={s.card}>
                    <ValueRow
                      icon={<Brain size={18} color={migrationStateColor(founderSession.migrationState)} />}
                      label="Migration State"
                      value={migrationStateLabel(founderSession.migrationState)}
                      valueColor={migrationStateColor(founderSession.migrationState)}
                      isLast={!verifiedSnapshotId && !importedCountsSummary && !importedDetailSummary}
                    />
                    {verifiedSnapshotId ? (
                      <ValueRow
                        icon={<Database size={18} color={colors.primary.DEFAULT} />}
                        label="Imported Snapshot"
                        value={verifiedSnapshotId}
                        isLast={!importedCountsSummary && !importedDetailSummary}
                      />
                    ) : null}
                    {importedCountsSummary ? (
                      <ValueRow
                        icon={<Database size={18} color={colors.primary.DEFAULT} />}
                        label="Imported Counts"
                        value={importedCountsSummary}
                        isLast={!importedDetailSummary}
                      />
                    ) : null}
                    {importedDetailSummary ? (
                      <ValueRow
                        icon={<Database size={18} color={colors.primary.DEFAULT} />}
                        label="Imported Detail"
                        value={importedDetailSummary}
                        isLast
                      />
                    ) : null}
                  </View>
                  <SectionFooter
                    text={
                      migrationError ||
                      'Imports your local AI learning data into the durable founder account.'
                    }
                  />
                </>
              )}

              {/* ── Actions ── */}
              <SectionHeader title="Actions" />
              <View style={s.card}>
                <LinkRow
                  icon={
                    isRestoring
                      ? <ActivityIndicator size={18} color={colors.primary.DEFAULT} />
                      : <RefreshCw size={18} color={colors.primary.DEFAULT} />
                  }
                  label={isRestoring ? 'Restoring...' : 'Restore Session'}
                  onPress={handleRestoreSession}
                />
                {isSignedIn && (
                  <LinkRow
                    icon={<Brain size={18} color={colors.primary.DEFAULT} />}
                    label={isMigratingLearning ? 'Migrating Learning...' : 'Migrate Learning'}
                    onPress={handleMigrateLearning}
                  />
                )}
                <LinkRow
                  icon={<Stethoscope size={18} color={colors.primary.DEFAULT} />}
                  label="Open Founder Diagnostics"
                  onPress={handleOpenDiagnostics}
                  isLast={!isSignedIn}
                />
                {isSignedIn && (
                  <Pressable
                    onPress={handleSignOut}
                    disabled={isSigningOut}
                    style={({ pressed }) => [s.row, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    <View style={[s.iconBox, { backgroundColor: '#FEE2E2' }]}>
                      <LogOut size={18} color="#EF4444" />
                    </View>
                    <Text style={styles.signOutLabel}>
                      {isSigningOut ? 'Signing Out...' : 'Sign Out Founder'}
                    </Text>
                    {isSigningOut && <ActivityIndicator size="small" color="#EF4444" />}
                  </Pressable>
                )}
              </View>
              <SectionFooter text="Founder sign-in does not replace the current Hostaway personal-mode workflow." />
            </>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.semibold,
    color: '#000000',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 40,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#6B7280',
    marginTop: 12,
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
  },
  inputLabel: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    color: colors.text.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: typography.fontFamily.regular,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: typography.fontFamily.regular,
  },
  signOutLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.fontFamily.regular,
    color: '#EF4444',
  },
});
