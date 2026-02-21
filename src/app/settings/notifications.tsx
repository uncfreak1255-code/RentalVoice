import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NotificationSettingsScreen } from '@/components/NotificationSettingsScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function NotificationsRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <NotificationSettingsScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
