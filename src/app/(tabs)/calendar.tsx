import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CalendarScreen } from '@/components/CalendarScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function CalendarTab() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <CalendarScreen onBack={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
});
