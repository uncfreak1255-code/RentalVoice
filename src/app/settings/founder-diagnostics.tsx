import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FounderDiagnosticsScreen } from '@/components/FounderDiagnosticsScreen';
import { colors } from '@/lib/design-tokens';

export default function FounderDiagnosticsRoute() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <FounderDiagnosticsScreen onBack={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
});
