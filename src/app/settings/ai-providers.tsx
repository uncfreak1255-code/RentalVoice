import React from 'react';
import { useRouter } from 'expo-router';
import { AIProviderSettingsScreen } from '@/components/AIProviderSettingsScreen';

export default function AIProvidersRoute() {
  const router = useRouter();

  return <AIProviderSettingsScreen onBack={() => router.back()} />;
}
