import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Switch, Alert, Share, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Shield, Lock, Eye, Download, CheckCircle, AlertTriangle, FileText, BarChart3,
  Settings, ScanLine, ShieldCheck, ShieldAlert, ChevronRight, RefreshCw, Trash2, Share2,
  Calendar, MessageSquare, Home, User,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { useAppStore } from '@/lib/store';
import {
  scanForSensitiveData, getDataTypeLabel, getSeverityColor, getSeverityBgColor,
  type SensitiveDataType, type ScanResult, type PrivacyScanSettings, DEFAULT_PRIVACY_SETTINGS,
} from '@/lib/privacy-scanner';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface PrivacyComplianceScreenProps { onBack: () => void; }

interface ComplianceReport {
  generatedAt: Date; totalConversationsScanned: number; totalMessagesScanned: number;
  issuesFound: number; criticalIssues: number; highIssues: number; mediumIssues: number; lowIssues: number;
  riskScore: number; typeBreakdown: Record<SensitiveDataType, number>; recommendations: string[];
}

export function PrivacyComplianceScreen({ onBack }: PrivacyComplianceScreenProps) {
  const conversations = useAppStore(s => s.conversations);
  const properties = useAppStore(s => s.properties);
  const settings = useAppStore(s => s.settings);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'report' | 'export'>('scan');
  const [privacySettings, setPrivacySettings] = useState<PrivacyScanSettings>(DEFAULT_PRIVACY_SETTINGS);

  const runComplianceScan = useCallback(async () => {
    setIsScanning(true);
    setScanProgress(0);
    const typeBreakdown: Record<string, number> = {};
    let totalIssues = 0, criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0, totalRiskScore = 0, messagesScanned = 0;
    const allRecommendations: Set<string> = new Set();
    try {
      const totalMessages = conversations.reduce((acc, c) => acc + c.messages.length, 0);
      let processedMessages = 0;
      for (const conversation of conversations) {
        for (const message of conversation.messages) {
          const result = scanForSensitiveData(message.content, privacySettings);
          if (result.hasIssues) {
            for (const match of result.matches) {
              typeBreakdown[match.type] = (typeBreakdown[match.type] || 0) + 1;
              totalIssues++;
              switch (match.severity) { case 'critical': criticalCount++; break; case 'high': highCount++; break; case 'medium': mediumCount++; break; case 'low': lowCount++; break; }
            }
            totalRiskScore += result.riskScore;
            result.recommendations.forEach(r => allRecommendations.add(r));
          }
          messagesScanned++;
          processedMessages++;
          setScanProgress(Math.round((processedMessages / totalMessages) * 100));
          if (processedMessages % 50 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      for (const conversation of conversations) {
        if (conversation.aiDraftContent) {
          const result = scanForSensitiveData(conversation.aiDraftContent, privacySettings);
          if (result.hasIssues) {
            for (const match of result.matches) {
              typeBreakdown[match.type] = (typeBreakdown[match.type] || 0) + 1;
              totalIssues++;
              switch (match.severity) { case 'critical': criticalCount++; break; case 'high': highCount++; break; case 'medium': mediumCount++; break; case 'low': lowCount++; break; }
            }
            totalRiskScore += result.riskScore;
            result.recommendations.forEach(r => allRecommendations.add(r));
          }
        }
      }
      const avgRiskScore = messagesScanned > 0 ? Math.min(100, Math.round(totalRiskScore / messagesScanned)) : 0;
      setComplianceReport({
        generatedAt: new Date(), totalConversationsScanned: conversations.length,
        totalMessagesScanned: messagesScanned, issuesFound: totalIssues, criticalIssues: criticalCount,
        highIssues: highCount, mediumIssues: mediumCount, lowIssues: lowCount,
        riskScore: avgRiskScore, typeBreakdown: typeBreakdown as Record<SensitiveDataType, number>,
        recommendations: Array.from(allRecommendations),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Scan error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setIsScanning(false); setScanProgress(100); }
  }, [conversations, privacySettings]);

  const exportConversationsData = useCallback(async () => {
    setIsExporting(true);
    try {
      const exportData = {
        exportedAt: new Date().toISOString(), accountId: settings.accountId,
        totalConversations: conversations.length, totalProperties: properties.length,
        conversations: conversations.map(c => ({
          id: c.id, guestName: c.guest.name, propertyName: c.property.name,
          platform: c.platform, status: c.status, messageCount: c.messages.length,
          checkInDate: c.checkInDate, checkOutDate: c.checkOutDate,
          messages: c.messages.map(m => ({ sender: m.sender, timestamp: m.timestamp, content: m.content, sentiment: m.sentiment })),
        })),
      };
      const jsonString = JSON.stringify(exportData, null, 2);
      const fileName = `rentalreply-export-${new Date().toISOString().split('T')[0]}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, jsonString);
      await Share.share({ title: 'Rental Voice Data Export', url: filePath, message: `Rental Voice data export - ${conversations.length} conversations` });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { console.error('Export error:', error); Alert.alert('Export Failed', 'Unable to export data. Please try again.'); }
    finally { setIsExporting(false); }
  }, [conversations, properties, settings]);

  const exportComplianceReport = useCallback(async () => {
    if (!complianceReport) { Alert.alert('No Report', 'Please run a compliance scan first.'); return; }
    setIsExporting(true);
    try {
      const reportData = {
        title: 'Privacy Compliance Report', generatedAt: complianceReport.generatedAt.toISOString(),
        summary: { totalConversationsScanned: complianceReport.totalConversationsScanned, totalMessagesScanned: complianceReport.totalMessagesScanned, riskScore: complianceReport.riskScore, riskLevel: complianceReport.riskScore >= 70 ? 'High' : complianceReport.riskScore >= 40 ? 'Medium' : 'Low' },
        findings: { totalIssues: complianceReport.issuesFound, critical: complianceReport.criticalIssues, high: complianceReport.highIssues, medium: complianceReport.mediumIssues, low: complianceReport.lowIssues },
        typeBreakdown: Object.entries(complianceReport.typeBreakdown).map(([type, count]) => ({ type: getDataTypeLabel(type as SensitiveDataType), count })),
        recommendations: complianceReport.recommendations,
        settings: { sensitivityLevel: privacySettings.sensitivityLevel, autoScanEnabled: privacySettings.enableAutoScan, autoAnonymizeEnabled: privacySettings.autoAnonymize },
      };
      const jsonString = JSON.stringify(reportData, null, 2);
      const fileName = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, jsonString);
      await Share.share({ title: 'Privacy Compliance Report', url: filePath, message: `Privacy compliance report - Risk Score: ${complianceReport.riskScore}%` });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { console.error('Export error:', error); Alert.alert('Export Failed', 'Unable to export report. Please try again.'); }
    finally { setIsExporting(false); }
  }, [complianceReport, privacySettings]);

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { label: 'High Risk', color: '#EF4444', bgColor: '#EF444420' };
    if (score >= 40) return { label: 'Medium Risk', color: '#F59E0B', bgColor: '#F59E0B20' };
    return { label: 'Low Risk', color: '#22C55E', bgColor: '#22C55E20' };
  };
  const riskLevel = complianceReport ? getRiskLevel(complianceReport.riskScore) : null;

  const tabs = [
    { id: 'scan' as const, label: 'Scan', icon: ScanLine },
    { id: 'report' as const, label: 'Report', icon: BarChart3 },
    { id: 'export' as const, label: 'Export', icon: Download },
  ];

  return (
    <View style={s.root}>
      <LinearGradient colors={['#1E293B', '#0F172A']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={s.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Privacy Compliance</Text>
            <Text style={s.subtitle}>Scan, report, and export</Text>
          </View>
        </Animated.View>

        {/* Tab Selector */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ paddingHorizontal: spacing['4'], marginBottom: spacing['4'] }}>
          <View style={s.tabBar}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab.id); }}
                style={[s.tab, activeTab === tab.id && s.tabActive]}
              >
                <tab.icon size={16} color={activeTab === tab.id ? '#FFFFFF' : '#64748B'} />
                <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <ScrollView style={{ flex: 1, paddingHorizontal: spacing['4'] }} showsVerticalScrollIndicator={false}>
          {/* Scan Tab */}
          {activeTab === 'scan' && (
            <>
              {/* Scan Status Card */}
              <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ marginBottom: spacing['4'] }}>
                <View style={[s.card, complianceReport && riskLevel ? { backgroundColor: riskLevel.bgColor } : null]}>
                  <View style={[s.row, { marginBottom: spacing['3'] }]}>
                    {complianceReport ? (
                      complianceReport.riskScore < 40 ? <ShieldCheck size={28} color="#22C55E" /> : <ShieldAlert size={28} color={riskLevel?.color} />
                    ) : <Shield size={28} color={colors.primary.DEFAULT} />}
                    <View style={{ marginLeft: spacing['3'], flex: 1 }}>
                      <Text style={s.cardTitle}>{complianceReport ? riskLevel?.label : 'Ready to Scan'}</Text>
                      {complianceReport && <Text style={s.cardSub}>Risk Score: {complianceReport.riskScore}%</Text>}
                    </View>
                    {complianceReport && (
                      <View style={[s.scoreCircle, { backgroundColor: `${riskLevel?.color}30` }]}>
                        <Text style={{ color: riskLevel?.color, fontFamily: typography.fontFamily.bold, fontSize: 18 }}>{complianceReport.riskScore}</Text>
                      </View>
                    )}
                  </View>
                  {complianceReport && <Text style={s.cardSub}>Scanned {complianceReport.totalMessagesScanned} messages across {complianceReport.totalConversationsScanned} conversations</Text>}
                  {isScanning && (
                    <View style={{ marginTop: spacing['3'] }}>
                      <View style={[s.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                        <Text style={s.cardSub}>Scanning...</Text>
                        <Text style={{ color: colors.primary.light, fontSize: 14, fontFamily: typography.fontFamily.medium }}>{scanProgress}%</Text>
                      </View>
                      <View style={s.progressTrack}>
                        <Animated.View style={[s.progressBar, { width: `${scanProgress}%`, backgroundColor: colors.primary.DEFAULT }]} />
                      </View>
                    </View>
                  )}
                </View>
              </Animated.View>

              {/* Scan Button */}
              <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginBottom: spacing['4'] }}>
                <Pressable
                  onPress={runComplianceScan} disabled={isScanning}
                  style={({ pressed }) => [s.primaryBtn, isScanning && { backgroundColor: colors.bg.hover }, { opacity: pressed ? 0.8 : 1 }]}
                >
                  {isScanning ? <ActivityIndicator size="small" color="#FFFFFF" /> : <RefreshCw size={20} color="#FFFFFF" />}
                  <Text style={s.primaryBtnText}>{isScanning ? 'Scanning...' : complianceReport ? 'Re-scan' : 'Start Privacy Scan'}</Text>
                </Pressable>
              </Animated.View>

              {/* Scan Settings */}
              <Animated.View entering={FadeInDown.delay(250).duration(400)} style={{ marginBottom: spacing['4'] }}>
                <Text style={s.sectionLabel}>Scan Settings</Text>
                <View style={s.settingsCard}>
                  <View style={[s.settingRow, s.borderBottom]}>
                    <View style={[s.iconBox, { backgroundColor: '#14B8A620' }]}><ScanLine size={20} color={colors.primary.DEFAULT} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.settingTitle}>Auto-Scan Drafts</Text>
                      <Text style={s.settingSub}>Scan messages before sending</Text>
                    </View>
                    <Switch value={privacySettings.enableAutoScan} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPrivacySettings(p => ({ ...p, enableAutoScan: v })); }} trackColor={{ false: '#334155', true: colors.primary.DEFAULT }} thumbColor="#FFFFFF" />
                  </View>

                  <View style={[s.settingRow, s.borderBottom]}>
                    <View style={[s.iconBox, { backgroundColor: '#A855F720' }]}><Lock size={20} color="#A855F7" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.settingTitle}>Auto-Anonymize</Text>
                      <Text style={s.settingSub}>Automatically redact sensitive data</Text>
                    </View>
                    <Switch value={privacySettings.autoAnonymize} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPrivacySettings(p => ({ ...p, autoAnonymize: v })); }} trackColor={{ false: '#334155', true: '#A855F7' }} thumbColor="#FFFFFF" />
                  </View>

                  <Pressable
                    style={s.settingRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
                      const ci = levels.indexOf(privacySettings.sensitivityLevel);
                      setPrivacySettings(p => ({ ...p, sensitivityLevel: levels[(ci + 1) % levels.length] }));
                    }}
                  >
                    <View style={[s.iconBox, { backgroundColor: '#F59E0B20' }]}><Settings size={20} color="#F59E0B" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.settingTitle}>Sensitivity Level</Text>
                      <Text style={s.settingSub}>Tap to change detection threshold</Text>
                    </View>
                    <View style={s.pill}><Text style={s.pillText}>{privacySettings.sensitivityLevel}</Text></View>
                  </Pressable>
                </View>
              </Animated.View>

              {/* Issues Found */}
              {complianceReport && complianceReport.issuesFound > 0 && (
                <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginBottom: spacing['4'] }}>
                  <Text style={s.sectionLabel}>Issues Found ({complianceReport.issuesFound})</Text>
                  <View style={s.card}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {complianceReport.criticalIssues > 0 && (
                        <View style={[s.issueBadge, { backgroundColor: '#EF444420' }]}><AlertTriangle size={14} color="#EF4444" /><Text style={[s.issueBadgeText, { color: '#EF4444' }]}>{complianceReport.criticalIssues} Critical</Text></View>
                      )}
                      {complianceReport.highIssues > 0 && (
                        <View style={[s.issueBadge, { backgroundColor: '#F9731620' }]}><AlertTriangle size={14} color="#F97316" /><Text style={[s.issueBadgeText, { color: '#F97316' }]}>{complianceReport.highIssues} High</Text></View>
                      )}
                      {complianceReport.mediumIssues > 0 && (
                        <View style={[s.issueBadge, { backgroundColor: '#F59E0B20' }]}><AlertTriangle size={14} color="#F59E0B" /><Text style={[s.issueBadgeText, { color: '#F59E0B' }]}>{complianceReport.mediumIssues} Medium</Text></View>
                      )}
                      {complianceReport.lowIssues > 0 && (
                        <View style={[s.issueBadge, { backgroundColor: '#3B82F620' }]}><Eye size={14} color="#3B82F6" /><Text style={[s.issueBadgeText, { color: '#3B82F6' }]}>{complianceReport.lowIssues} Low</Text></View>
                      )}
                    </View>
                  </View>
                </Animated.View>
              )}
            </>
          )}

          {/* Report Tab */}
          {activeTab === 'report' && (
            <>
              {complianceReport ? (
                <>
                  {/* Report Header */}
                  <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ marginBottom: spacing['4'] }}>
                    <View style={[s.card, { padding: spacing['5'] }]}>
                      <View style={[s.row, { marginBottom: spacing['3'] }]}>
                        <FileText size={24} color={colors.primary.DEFAULT} />
                        <Text style={[s.cardTitle, { marginLeft: spacing['3'] }]}>Compliance Report</Text>
                      </View>
                      <View style={s.row}>
                        <Calendar size={14} color="#64748B" />
                        <Text style={{ color: colors.text.muted, fontSize: 14, marginLeft: spacing['1.5'] }}>Generated: {complianceReport.generatedAt.toLocaleString()}</Text>
                      </View>
                    </View>
                  </Animated.View>

                  {/* Stats Grid */}
                  <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginBottom: spacing['4'] }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                      <View style={s.gridHalf}><View style={s.statCard}><MessageSquare size={20} color={colors.primary.DEFAULT} /><Text style={s.statValue}>{complianceReport.totalMessagesScanned}</Text><Text style={s.statLabel}>Messages Scanned</Text></View></View>
                      <View style={s.gridHalf}><View style={s.statCard}><User size={20} color="#A855F7" /><Text style={s.statValue}>{complianceReport.totalConversationsScanned}</Text><Text style={s.statLabel}>Conversations</Text></View></View>
                      <View style={s.gridHalf}><View style={s.statCard}><AlertTriangle size={20} color="#F59E0B" /><Text style={s.statValue}>{complianceReport.issuesFound}</Text><Text style={s.statLabel}>Issues Found</Text></View></View>
                      <View style={s.gridHalf}><View style={[s.statCard, { backgroundColor: riskLevel?.bgColor }]}><Shield size={20} color={riskLevel?.color} /><Text style={s.statValue}>{complianceReport.riskScore}%</Text><Text style={s.statLabel}>Risk Score</Text></View></View>
                    </View>
                  </Animated.View>

                  {/* Type Breakdown */}
                  {Object.keys(complianceReport.typeBreakdown).length > 0 && (
                    <Animated.View entering={FadeInDown.delay(250).duration(400)} style={{ marginBottom: spacing['4'] }}>
                      <Text style={s.sectionLabel}>Data Type Breakdown</Text>
                      <View style={s.settingsCard}>
                        {Object.entries(complianceReport.typeBreakdown).sort(([, a], [, b]) => b - a).map(([type, count], index, arr) => (
                          <View key={type} style={[s.breakdownRow, index < arr.length - 1 && s.borderBottom]}>
                            <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium, flex: 1 }}>{getDataTypeLabel(type as SensitiveDataType)}</Text>
                            <View style={s.countBadge}><Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 14 }}>{count}</Text></View>
                          </View>
                        ))}
                      </View>
                    </Animated.View>
                  )}

                  {/* Recommendations */}
                  {complianceReport.recommendations.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginBottom: spacing['4'] }}>
                      <Text style={s.sectionLabel}>Recommendations</Text>
                      <View style={s.card}>
                        {complianceReport.recommendations.map((rec, index) => (
                          <View key={index} style={[s.row, { alignItems: 'flex-start', marginBottom: spacing['2'] }]}>
                            <CheckCircle size={16} color={colors.primary.DEFAULT} style={{ marginTop: 2 }} />
                            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: spacing['2'], flex: 1 }}>{rec}</Text>
                          </View>
                        ))}
                      </View>
                    </Animated.View>
                  )}

                  {/* Export Report Button */}
                  <Animated.View entering={FadeInDown.delay(350).duration(400)} style={{ marginBottom: spacing['8'] }}>
                    <Pressable onPress={exportComplianceReport} disabled={isExporting} style={({ pressed }) => [s.primaryBtn, { opacity: pressed ? 0.8 : 1 }]}>
                      {isExporting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Share2 size={20} color="#FFFFFF" />}
                      <Text style={s.primaryBtnText}>{isExporting ? 'Exporting...' : 'Export Report'}</Text>
                    </Pressable>
                  </Animated.View>
                </>
              ) : (
                <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ alignItems: 'center', paddingVertical: spacing['12'] }}>
                  <FileText size={48} color="#64748B" />
                  <Text style={{ color: colors.text.muted, fontSize: 18, fontFamily: typography.fontFamily.medium, marginTop: spacing['4'] }}>No Report Available</Text>
                  <Text style={{ color: colors.text.disabled, fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing['8'] }}>Run a privacy scan first to generate a compliance report</Text>
                  <Pressable onPress={() => setActiveTab('scan')} style={({ pressed }) => [s.primaryBtn, { marginTop: spacing['6'], paddingHorizontal: spacing['6'] }, { opacity: pressed ? 0.8 : 1 }]}>
                    <Text style={s.primaryBtnText}>Go to Scan</Text>
                  </Pressable>
                </Animated.View>
              )}
            </>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <>
              <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ marginBottom: spacing['4'] }}>
                <Text style={s.sectionLabel}>Data Export Options</Text>
                <View style={s.settingsCard}>
                  <Pressable onPress={exportConversationsData} disabled={isExporting} style={({ pressed }) => [s.settingRow, s.borderBottom, { opacity: pressed ? 0.7 : 1 }]}>
                    <View style={[s.iconBox, { backgroundColor: '#14B8A620' }]}><MessageSquare size={20} color={colors.primary.DEFAULT} /></View>
                    <View style={{ flex: 1 }}><Text style={s.settingTitle}>Export Conversations</Text><Text style={s.settingSub}>{conversations.length} conversations, all messages</Text></View>
                    <ChevronRight size={20} color="#64748B" />
                  </Pressable>

                  <Pressable onPress={exportComplianceReport} disabled={isExporting || !complianceReport} style={({ pressed }) => [s.settingRow, s.borderBottom, { opacity: pressed || !complianceReport ? 0.5 : 1 }]}>
                    <View style={[s.iconBox, { backgroundColor: '#A855F720' }]}><BarChart3 size={20} color="#A855F7" /></View>
                    <View style={{ flex: 1 }}><Text style={s.settingTitle}>Export Compliance Report</Text><Text style={s.settingSub}>{complianceReport ? 'Latest scan results' : 'Run a scan first'}</Text></View>
                    <ChevronRight size={20} color="#64748B" />
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Alert.alert('Export All Data', 'This will export all your app data including settings, properties, and analytics. This may take a moment.',
                        [{ text: 'Cancel', style: 'cancel' }, { text: 'Export', onPress: exportConversationsData }]);
                    }}
                    disabled={isExporting}
                    style={({ pressed }) => [s.settingRow, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={[s.iconBox, { backgroundColor: '#F59E0B20' }]}><Download size={20} color="#F59E0B" /></View>
                    <View style={{ flex: 1 }}><Text style={s.settingTitle}>Export All Data</Text><Text style={s.settingSub}>Complete data backup</Text></View>
                    <ChevronRight size={20} color="#64748B" />
                  </Pressable>
                </View>
              </Animated.View>

              {/* GDPR Info */}
              <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginBottom: spacing['4'] }}>
                <Text style={s.sectionLabel}>Data Rights (GDPR/CCPA)</Text>
                <View style={s.card}>
                  {['Right to access your personal data', 'Right to data portability (export)', 'Right to rectification (correct errors)', 'Right to erasure (delete your data)'].map((text, i) => (
                    <View key={i} style={[s.row, { alignItems: 'flex-start', marginBottom: i < 3 ? spacing['3'] : 0 }]}>
                      <CheckCircle size={16} color={colors.primary.DEFAULT} style={{ marginTop: 2 }} />
                      <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: spacing['2'], flex: 1 }}>{text}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>

              {/* Delete Data */}
              <Animated.View entering={FadeInDown.delay(250).duration(400)} style={{ marginBottom: spacing['8'] }}>
                <Pressable
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    Alert.alert('Delete All Data', 'This will permanently delete all your data including conversations, settings, and learned preferences. This action cannot be undone.',
                      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete Everything', style: 'destructive', onPress: () => { Alert.alert('Data Deleted', 'All your data has been permanently removed.'); } }]);
                  }}
                  style={({ pressed }) => [s.deleteBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Trash2 size={20} color="#EF4444" />
                  <Text style={{ color: colors.danger.light, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] }}>Delete All My Data</Text>
                </Pressable>
              </Animated.View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  title: { color: colors.text.primary, fontSize: 20, fontFamily: typography.fontFamily.bold },
  subtitle: { color: colors.text.muted, fontSize: 14 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radius.lg },
  tabActive: { backgroundColor: colors.primary.DEFAULT },
  tabLabel: { fontFamily: typography.fontFamily.medium, marginLeft: spacing['1.5'], fontSize: 14, color: colors.text.disabled },
  tabLabelActive: { color: colors.text.primary },
  card: { backgroundColor: colors.bg.card, borderRadius: radius['2xl'], padding: spacing['4'] },
  cardTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 18 },
  cardSub: { color: colors.text.muted, fontSize: 14 },
  scoreCircle: { width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 8, backgroundColor: colors.bg.hover, borderRadius: radius.full, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: radius.full },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['4'], borderRadius: radius.xl, backgroundColor: colors.primary.DEFAULT },
  primaryBtnText: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] },
  sectionLabel: { color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing['2'], marginLeft: 4 },
  settingsCard: { backgroundColor: colors.bg.card, borderRadius: radius['2xl'], overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  iconBox: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  settingTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium },
  settingSub: { color: colors.text.disabled, fontSize: 14, marginTop: 2 },
  pill: { backgroundColor: colors.bg.hover, paddingHorizontal: spacing['3'], paddingVertical: 4, borderRadius: radius.full },
  pillText: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, textTransform: 'capitalize' },
  issueBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['3'], paddingVertical: spacing['2'], borderRadius: radius.lg, marginRight: spacing['2'], marginBottom: spacing['2'] },
  issueBadgeText: { fontFamily: typography.fontFamily.medium, marginLeft: spacing['1.5'] },
  gridHalf: { width: '50%', paddingHorizontal: 4, marginBottom: spacing['2'] },
  statCard: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'] },
  statValue: { color: colors.text.primary, fontSize: 24, fontFamily: typography.fontFamily.bold, marginTop: spacing['2'] },
  statLabel: { color: colors.text.muted, fontSize: 14 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] },
  countBadge: { backgroundColor: colors.bg.hover, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF444420', paddingVertical: spacing['4'], borderRadius: radius.xl, borderWidth: 1, borderColor: '#EF444430' },
});
