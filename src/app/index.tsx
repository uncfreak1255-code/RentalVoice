import React, { useState, useCallback, useEffect } from 'react';
import { View, StatusBar, ActivityIndicator, Text } from 'react-native';
import { useAppStore } from '@/lib/store';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { InboxDashboard } from '@/components/InboxDashboard';
import { ChatScreen } from '@/components/ChatScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { PropertyKnowledgeScreen } from '@/components/PropertyKnowledgeScreen';
import { IssueTrackerScreen } from '@/components/IssueTrackerScreen';
import { AutomationsScreen } from '@/components/AutomationsScreen';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { UpsellsScreen } from '@/components/UpsellsScreen';
import { GuestPortal } from '@/components/GuestPortal';
import { ApiSettingsScreen } from '@/components/ApiSettingsScreen';
import { SyncDataScreen } from '@/components/SyncDataScreen';
import { LanguageSettingsScreen } from '@/components/LanguageSettingsScreen';
import { HelpCenterScreen } from '@/components/HelpCenterScreen';
import { PrivacySecurityScreen } from '@/components/PrivacySecurityScreen';
import { PrivacyComplianceScreen } from '@/components/PrivacyComplianceScreen';
import { AILearningScreen } from '@/components/AILearningScreen';
import { WebhookSetupScreen } from '@/components/WebhookSetupScreen';
import { NotificationSettingsScreen } from '@/components/NotificationSettingsScreen';
import { AutoPilotSettingsScreen } from '@/components/AutoPilotSettingsScreen';
import { AutoPilotAuditLogScreen } from '@/components/AutoPilotAuditLogScreen';
import { SentimentTrendsDashboard } from '@/components/SentimentTrendsDashboard';
import { CalendarScreen } from '@/components/CalendarScreen';
import { AIProviderSettingsScreen } from '@/components/AIProviderSettingsScreen';
import * as SplashScreen from 'expo-splash-screen';
import { restoreConnection } from '@/lib/hostaway';
import { useNotifications } from '@/lib/NotificationProvider';
import Animated, { FadeIn } from 'react-native-reanimated';

type Screen = 'inbox' | 'chat' | 'settings' | 'propertyKnowledge' | 'issueTracker' | 'automations' | 'analytics' | 'upsells' | 'guestPortal' | 'apiSettings' | 'syncData' | 'languageSettings' | 'helpCenter' | 'privacySecurity' | 'privacyCompliance' | 'aiLearning' | 'webhookSetup' | 'notificationSettings' | 'autoPilotSettings' | 'autoPilotAuditLog' | 'sentimentTrends' | 'calendar' | 'aiProviders';

export default function HomeScreen() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('inbox');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isRestoringConnection, setIsRestoringConnection] = useState(true);
  const [needsReauth, setNeedsReauth] = useState(false);

  const isOnboarded = useAppStore((s) => s.settings.isOnboarded);
  const resetStore = useAppStore((s) => s.resetStore);
  const setCredentials = useAppStore((s) => s.setCredentials);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);

  const { lastNotificationData } = useNotifications();

  // Handle deep linking from notification tap
  useEffect(() => {
    if (activeConversationId && isOnboarded && !isRestoringConnection) {
      console.log('[App] Deep linking to conversation:', activeConversationId);
      setSelectedConversationId(activeConversationId);
      setCurrentScreen('chat');
      // Clear active conversation after navigating
      setActiveConversation(null);
    }
  }, [activeConversationId, isOnboarded, isRestoringConnection, setActiveConversation]);

  // Restore connection from secure storage on app startup
  useEffect(() => {
    async function tryRestoreConnection() {
      // Skip if not onboarded or in demo mode
      if (!isOnboarded || isDemoMode) {
        setIsRestoringConnection(false);
        return;
      }

      console.log('[App] Attempting to restore Hostaway connection...');
      try {
        const result = await restoreConnection();

        if (result.connected && result.accountId && result.apiKey) {
          // Update store with restored credentials
          setCredentials(result.accountId, result.apiKey);
          console.log('[App] Connection restored successfully');
        } else if (result.needsReauth) {
          // Credentials invalid, need to re-authenticate
          console.log('[App] Credentials invalid, need re-authentication');
          setNeedsReauth(true);
        }
      } catch (error) {
        console.error('[App] Failed to restore connection:', error);
      } finally {
        setIsRestoringConnection(false);
        // Fallback to hide splash screen if RootLayout didn't handle it
        SplashScreen.hideAsync().catch(() => {});
      }
    }

    tryRestoreConnection();
  }, [isOnboarded, isDemoMode, setCredentials]);

  const handleOnboardingComplete = useCallback(() => {
    // Store is already updated by onboarding
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
    setCurrentScreen('chat');
  }, []);

  const handleBackToInbox = useCallback(() => {
    setCurrentScreen('inbox');
    setSelectedConversationId(null);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setCurrentScreen('settings');
  }, []);

  const handleOpenCalendar = useCallback(() => {
    setCurrentScreen('calendar');
  }, []);

  const handleBackFromSettings = useCallback(() => {
    setCurrentScreen('inbox');
  }, []);

  const handleLogout = useCallback(() => {
    resetStore();
  }, [resetStore]);

  const handleNavigateFromSettings = useCallback((screen: string) => {
    setCurrentScreen(screen as Screen);
  }, []);

  const handleBackToSettings = useCallback(() => {
    setCurrentScreen('settings');
  }, []);

  // Ensure splash screen is hidden once we are done with initial restoration
  useEffect(() => {
    if (!isRestoringConnection) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isRestoringConnection]);

  // Show loading while restoring connection
  if (isRestoringConnection) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center">
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text className="text-slate-400 mt-4">Connecting...</Text>
      </View>
    );
  }

  // Show onboarding if not completed or if re-authentication is needed
  if (!isOnboarded || needsReauth) {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <OnboardingScreen onComplete={() => {
          handleOnboardingComplete();
          setNeedsReauth(false);
        }} />
      </>
    );
  }

  return (
    <View className="flex-1 bg-slate-900">
      <StatusBar barStyle="light-content" />

      {currentScreen === 'inbox' && (
        <Animated.View
          key="inbox"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <InboxDashboard
            onSelectConversation={handleSelectConversation}
            onOpenSettings={handleOpenSettings}
            onOpenCalendar={handleOpenCalendar}
          />
        </Animated.View>
      )}

      {currentScreen === 'chat' && selectedConversationId && (
        <Animated.View
          key="chat"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <ChatScreen
            conversationId={selectedConversationId}
            onBack={handleBackToInbox}
          />
        </Animated.View>
      )}

      {currentScreen === 'settings' && (
        <Animated.View
          key="settings"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <SettingsScreen
            onBack={handleBackFromSettings}
            onLogout={handleLogout}
            onNavigate={handleNavigateFromSettings}
          />
        </Animated.View>
      )}

      {currentScreen === 'propertyKnowledge' && (
        <Animated.View
          key="propertyKnowledge"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <PropertyKnowledgeScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'issueTracker' && (
        <Animated.View
          key="issueTracker"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <IssueTrackerScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'automations' && (
        <Animated.View
          key="automations"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <AutomationsScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'analytics' && (
        <Animated.View
          key="analytics"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <AnalyticsDashboard onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'upsells' && (
        <Animated.View
          key="upsells"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <UpsellsScreen
            conversationId={selectedConversationId || undefined}
            onBack={handleBackToSettings}
          />
        </Animated.View>
      )}

      {currentScreen === 'guestPortal' && selectedPropertyId && (
        <Animated.View
          key="guestPortal"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <GuestPortal
            propertyId={selectedPropertyId}
            onBack={handleBackToSettings}
          />
        </Animated.View>
      )}

      {currentScreen === 'apiSettings' && (
        <Animated.View
          key="apiSettings"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <ApiSettingsScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'syncData' && (
        <Animated.View
          key="syncData"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <SyncDataScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'languageSettings' && (
        <Animated.View
          key="languageSettings"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <LanguageSettingsScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'helpCenter' && (
        <Animated.View
          key="helpCenter"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <HelpCenterScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'privacySecurity' && (
        <Animated.View
          key="privacySecurity"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <PrivacySecurityScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'privacyCompliance' && (
        <Animated.View
          key="privacyCompliance"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <PrivacyComplianceScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'aiLearning' && (
        <Animated.View
          key="aiLearning"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <AILearningScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'webhookSetup' && (
        <Animated.View
          key="webhookSetup"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <WebhookSetupScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'notificationSettings' && (
        <Animated.View
          key="notificationSettings"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <NotificationSettingsScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'autoPilotSettings' && (
        <Animated.View
          key="autoPilotSettings"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <AutoPilotSettingsScreen onBack={handleBackToSettings} onNavigate={(screen: string) => setCurrentScreen(screen as Screen)} />
        </Animated.View>
      )}

      {currentScreen === 'autoPilotAuditLog' && (
        <Animated.View
          key="autoPilotAuditLog"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <AutoPilotAuditLogScreen onBack={() => setCurrentScreen('autoPilotSettings')} />
        </Animated.View>
      )}

      {currentScreen === 'sentimentTrends' && (
        <Animated.View
          key="sentimentTrends"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <SentimentTrendsDashboard onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'aiProviders' && (
        <Animated.View
          key="aiProviders"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <AIProviderSettingsScreen onBack={handleBackToSettings} />
        </Animated.View>
      )}

      {currentScreen === 'calendar' && (
        <Animated.View
          key="calendar"
          entering={FadeIn.duration(300)}
          className="flex-1"
        >
          <CalendarScreen onBack={handleBackToInbox} />
        </Animated.View>
      )}
    </View>
  );
}
