import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrivacySecurityScreen } from '@/components/PrivacySecurityScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function PrivacySecurityRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <PrivacySecurityScreen onBack={() => router.navigate('/(tabs)/settings')} onNavigate={(screen) => router.push(`/settings/${screen}` as any)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
