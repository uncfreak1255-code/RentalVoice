import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SentimentTrendsDashboard } from '@/components/SentimentTrendsDashboard';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function SentimentTrendsRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <SentimentTrendsDashboard onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
