import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IssueTrackerScreen } from '@/components/IssueTrackerScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function IssueTrackerRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <IssueTrackerScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
