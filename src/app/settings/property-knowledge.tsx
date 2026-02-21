import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PropertyKnowledgeScreen } from '@/components/PropertyKnowledgeScreen';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/design-tokens';

export default function PropertyKnowledgeRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <PropertyKnowledgeScreen onBack={() => router.navigate('/(tabs)/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
});
