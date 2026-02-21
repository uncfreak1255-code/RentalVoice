import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AIProviderSettingsScreen } from '@/components/AIProviderSettingsScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function AIProvidersRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <AIProviderSettingsScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
