import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AutoPilotSettingsScreen } from '@/components/AutoPilotSettingsScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function AutoPilotRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <AutoPilotSettingsScreen
        onBack={() => router.navigate('/(tabs)/settings')}
        onNavigate={(screen: string) => {
          if (screen === 'autoPilotAuditLog') {
            router.push('/settings/auto-pilot-audit');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
