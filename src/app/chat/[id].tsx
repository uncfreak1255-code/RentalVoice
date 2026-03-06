import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChatScreen } from '@/components/ChatScreen';
import { colors } from '@/lib/design-tokens';

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id) {
    // Edge case: navigated here without an ID — go back
    router.back();
    return null;
  }

  return (
    <View style={styles.container}>
      <ChatScreen
        conversationId={id}
        onBack={() => router.back()}
        onOpenUpsells={() => router.push('/settings/billing?source=chat')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
});
