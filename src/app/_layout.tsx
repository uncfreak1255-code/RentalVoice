import React from 'react';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NotificationProvider } from '@/lib/NotificationProvider';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { colors } from '@/lib/design-tokens';
import { loadAllColdData } from '@/lib/cold-storage';
import { useAppStore } from '@/lib/store';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import '../../global.css';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Light theme using design tokens (Decision 4A)
const RentalVoiceLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
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
    <ThemeProvider value={RentalVoiceLightTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="chat/[id]"
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
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
  const [coldDataReady, setColdDataReady] = React.useState(false);

  // Hydrate cold data (conversations, training data, etc.) from AsyncStorage
  // into the Zustand store on app mount. Keeps splash visible until complete.
  React.useEffect(() => {
    let mounted = true;

    loadAllColdData()
      .then((coldData) => {
        if (!mounted) return;
        // Hydrate the store with cold data
        type StoreState = ReturnType<typeof useAppStore.getState>;
        useAppStore.setState({
          conversations: (coldData.conversations as StoreState['conversations']) || [],
          learningEntries: (coldData.learningEntries as StoreState['learningEntries']) || [],
          draftOutcomes: (coldData.draftOutcomes as StoreState['draftOutcomes']) || [],
          calibrationEntries: (coldData.calibrationEntries as StoreState['calibrationEntries']) || [],
          replyDeltas: (coldData.replyDeltas as StoreState['replyDeltas']) || [],
          conversationFlows: (coldData.conversationFlows as StoreState['conversationFlows']) || [],
          issues: (coldData.issues as StoreState['issues']) || [],
          favoriteMessages: (coldData.favoriteMessages as StoreState['favoriteMessages']) || [],
          autoPilotLogs: (coldData.autoPilotLogs as StoreState['autoPilotLogs']) || [],
        });
        setColdDataReady(true);
        console.log('[Layout] Cold data hydrated into store');
      })
      .catch((err) => {
        console.error('[Layout] Failed to load cold data:', err);
        if (mounted) setColdDataReady(true); // Don't block app on failure
      });

    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    if (!fontsLoaded || !coldDataReady) return;

    // Hide splash screen once fonts AND cold data are ready
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 300);

    // Register for push notifications
    registerForPushNotifications().catch(console.error);

    return () => clearTimeout(timer);
  }, [fontsLoaded, coldDataReady]);

  // Don't render until fonts AND cold data are loaded
  if (!fontsLoaded || !coldDataReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <NotificationProvider>
            <StatusBar style="dark" />
            <RootLayoutNav />
          </NotificationProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
