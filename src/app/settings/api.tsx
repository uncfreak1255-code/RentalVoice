import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ApiSettingsScreen } from '@/components/ApiSettingsScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function ApiRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <ApiSettingsScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
