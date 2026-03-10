import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FounderAccessScreen } from '@/components/FounderAccessScreen';
import { colors } from '@/lib/design-tokens';

export default function FounderAccessRoute() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <FounderAccessScreen onBack={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
});
