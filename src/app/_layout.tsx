import React from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NotificationProvider } from '@/lib/NotificationProvider';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { colors } from '@/lib/design-tokens';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import '../../global.css';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Custom dark theme using design tokens
const RentalVoiceDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary.DEFAULT,
    background: colors.bg.base,
    card: colors.bg.card,
    text: colors.text.primary,
    border: colors.border.subtle,
    notification: colors.accent.DEFAULT,
  },
};

function RootLayoutNav() {
  return (
    <ThemeProvider value={RentalVoiceDarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  React.useEffect(() => {
    if (!fontsLoaded) return;

    // Hide splash screen once fonts are loaded
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 300);

    // Register for push notifications
    registerForPushNotifications().catch(console.error);

    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  // Don't render until fonts are loaded
  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <NotificationProvider>
            <StatusBar style="light" />
            <RootLayoutNav />
          </NotificationProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
