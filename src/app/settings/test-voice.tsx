import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TestVoiceScreen } from '@/components/TestVoiceScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function TestVoiceRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <TestVoiceScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
