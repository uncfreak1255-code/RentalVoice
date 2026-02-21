import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrivacyComplianceScreen } from '@/components/PrivacyComplianceScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function PrivacyComplianceRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <PrivacyComplianceScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
