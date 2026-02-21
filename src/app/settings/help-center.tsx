import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HelpCenterScreen } from '@/components/HelpCenterScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function HelpCenterRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <HelpCenterScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
