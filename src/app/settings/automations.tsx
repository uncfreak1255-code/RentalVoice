import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AutomationsScreen } from '@/components/AutomationsScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function AutomationsRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <AutomationsScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
