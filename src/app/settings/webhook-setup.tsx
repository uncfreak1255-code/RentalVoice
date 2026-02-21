import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebhookSetupScreen } from '@/components/WebhookSetupScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function WebhookSetupRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <WebhookSetupScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
