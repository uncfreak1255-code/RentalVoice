import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ReviewResponseScreen } from '@/components/ReviewResponseScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function ReviewResponseRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <ReviewResponseScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
