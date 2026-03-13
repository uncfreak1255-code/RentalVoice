import React from 'react';
import { View, StyleSheet } from 'react-native';
import ConfidenceDetail from '@/components/ConfidenceDetail';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function VoiceConfidenceRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <ConfidenceDetail onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
