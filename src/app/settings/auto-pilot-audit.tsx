import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AutoPilotAuditLogScreen } from '@/components/AutoPilotAuditLogScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function AutoPilotAuditRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <AutoPilotAuditLogScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
