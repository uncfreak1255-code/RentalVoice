import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BillingScreen } from '@/components/BillingScreen';
import { colors } from '@/lib/design-tokens';

export default function BillingRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    source?: string;
    checkout?: string;
    portal?: string;
  }>();

  return (
    <View style={styles.container}>
      <BillingScreen
        onBack={() => router.back()}
        source={typeof params.source === 'string' ? params.source : 'settings'}
        checkoutStatus={typeof params.checkout === 'string' ? params.checkout : undefined}
        portalStatus={typeof params.portal === 'string' ? params.portal : undefined}
        onOpenFounderDiagnostics={() => router.push('/settings/founder-diagnostics')}
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
