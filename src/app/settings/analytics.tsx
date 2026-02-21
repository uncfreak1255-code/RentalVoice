import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function AnalyticsRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <AnalyticsDashboard onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
