import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LanguageSettingsScreen } from '@/components/LanguageSettingsScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function LanguageRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <LanguageSettingsScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
