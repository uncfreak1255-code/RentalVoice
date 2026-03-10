import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Shield, User, Mail, Clock, Database,
  LogIn, RefreshCw, Brain, Stethoscope, LogOut,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '@/lib/design-tokens';
import { SectionHeader, SectionFooter, ValueRow, LinkRow, s } from './ui/SettingsComponents';
import { useAppStore, type FounderSession } from '@/lib/store';
import { APP_MODE } from '@/lib/config';

interface FounderAccessScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

export function FounderAccessScreen({ onBack, onNavigate }: FounderAccessScreenProps) {
  const founderSession = useAppStore((s) => s.founderSession);
  const founderSessionLoading = useAppStore((s) => s.founderSessionLoading);
  const restoreFounderSession = useAppStore((s) => s.restoreFounderSession);
  const clearFounderSession = useAppStore((s) => s.clearFounderSession);

  const [isRestoring, setIsRestoring] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isSignedIn = !!founderSession;

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

  const handleSignIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Founder sign-in flow will be implemented in a future task.
    // For now, show an informational alert.
    Alert.alert(
      'Founder Sign In',
      'Founder authentication flow is not yet connected to the app UI. ' +
      'Use the bootstrap script to establish the founder session, then restore it here.',
    );
  }, []);

  const handleMigrateLearning = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!founderSession) {
      Alert.alert('Sign In Required', 'You must have an active founder session to migrate learning data.');
      return;
    }
    // Learning migration UI will be wired in a future task.
    Alert.alert(
      'Learning Migration',
      `Migration state: ${founderSession.migrationState}\n\n` +
      'Full migration flow will be available in a future update.',
    );
  }, [founderSession]);

  const handleOpenDiagnostics = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigate?.('founderDiagnostics');
  }, [onNavigate]);

  const handleSignOut = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Sign Out Founder',
      'This will clear the founder session from this device. Your account data on the server is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            setIsSigningOut(true);
            clearFounderSession();
            setIsSigningOut(false);
          },
        },
      ],
    );
  }, [clearFounderSession]);

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
                    : 'No active founder session. Sign in or restore from secure storage.'
                }
              />

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
                      isLast
                    />
                  </View>
                  <SectionFooter text="Imports your local AI learning data into the durable founder account." />
                </>
              )}

              {/* ── Actions ── */}
              <SectionHeader title="Actions" />
              <View style={s.card}>
                {!isSignedIn && (
                  <LinkRow
                    icon={<LogIn size={18} color={colors.primary.DEFAULT} />}
                    label="Sign In"
                    onPress={handleSignIn}
                  />
                )}
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
                    label="Migrate Learning"
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
  signOutLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.fontFamily.regular,
    color: '#EF4444',
  },
});
