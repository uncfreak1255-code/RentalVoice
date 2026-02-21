import React from 'react';
import { View, StyleSheet } from 'react-native';
import { UpsellsScreen } from '@/components/UpsellsScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function UpsellsRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <UpsellsScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
