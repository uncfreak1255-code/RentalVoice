import React from 'react';
import { View, StyleSheet } from 'react-native';
import { VoiceProfileScreen } from '@/components/VoiceProfileScreen';
import { colors } from '@/lib/design-tokens';

export default function VoiceTab() {
  return (
    <View style={styles.container}>
      <VoiceProfileScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
});
