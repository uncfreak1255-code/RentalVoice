import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AILearningScreen } from '@/components/AILearningScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function AILearningRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <AILearningScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
