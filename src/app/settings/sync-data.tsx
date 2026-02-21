import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SyncDataScreen } from '@/components/SyncDataScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function SyncDataRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <SyncDataScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
