import React from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { OnboardingScreen } from '@/components/OnboardingScreen';

export default function OnboardingRoute() {
  const router = useRouter();

  return (
    <>
      <StatusBar style="dark" />
      <OnboardingScreen onComplete={() => router.replace('/(tabs)')} />
    </>
  );
}
