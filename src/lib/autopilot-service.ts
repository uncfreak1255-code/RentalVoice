/**
 * AutoPilot Service
 * Handles confidence-based automation decisions with CoPilot/AutoPilot dual modes
 */

import type {
  AppSettings,
  AutoPilotActionLog,
  PropertyAutoPilotSettings,
  Conversation
} from './store';
import type { ConfidenceScore, SentimentAnalysis } from './ai-enhanced';

// Decision result from AutoPilot
export interface AutoPilotDecision {
  shouldAutoSend: boolean;
  action: AutoPilotActionLog['action'];
  reason: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  escalationRequired: boolean;
  blockedBySchedule: boolean;
  warnings: string[];
}

// Confidence meter colors and labels
export interface ConfidenceMeterConfig {
  color: string;
  bgColor: string;
  label: string;
  level: 'high' | 'medium' | 'low';
  canAutoSend: boolean;
}

/**
 * Get confidence meter configuration based on score
 */
export function getConfidenceMeterConfig(confidence: number): ConfidenceMeterConfig {
  if (confidence >= 90) {
    return {
      color: '#22C55E', // green-500
      bgColor: 'bg-green-500',
      label: 'High Confidence',
      level: 'high',
      canAutoSend: true,
    };
  } else if (confidence >= 70) {
    return {
      color: '#F59E0B', // amber-500
      bgColor: 'bg-amber-500',
      label: 'Medium Confidence',
      level: 'medium',
      canAutoSend: false,
    };
  } else {
    return {
      color: '#EF4444', // red-500
      bgColor: 'bg-red-500',
      label: 'Low Confidence',
      level: 'low',
      canAutoSend: false,
    };
  }
}

/**
 * Get confidence bar gradient colors for visual meter
 */
export function getConfidenceGradient(confidence: number): [string, string] {
  if (confidence >= 90) {
    return ['#22C55E', '#16A34A']; // green
  } else if (confidence >= 70) {
    return ['#F59E0B', '#D97706']; // amber
  } else if (confidence >= 50) {
    return ['#F97316', '#EA580C']; // orange
  } else {
    return ['#EF4444', '#DC2626']; // red
  }
}

/**
 * Check if current time is within AutoPilot schedule
 */
export function isWithinSchedule(settings: AppSettings): boolean {
  if (!settings.autoPilotScheduleEnabled) {
    return true; // No schedule = always active
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Check if current day is in allowed days
  if (!settings.autoPilotScheduleDays.includes(currentDay)) {
    return false;
  }

  // Check if current time is within start-end range
  const start = settings.autoPilotScheduleStart;
  const end = settings.autoPilotScheduleEnd;

  // Handle overnight schedules (e.g., 22:00 - 06:00)
  if (start > end) {
    return currentTime >= start || currentTime <= end;
  }

  return currentTime >= start && currentTime <= end;
}

/**
 * Check if message content contains sensitive/escalation topics
 */
export function containsSensitiveTopics(
  content: string,
  escalationTopics: string[],
  sentiment?: SentimentAnalysis
): { hasSensitive: boolean; matchedTopics: string[] } {
  const lowerContent = content.toLowerCase();
  const matchedTopics: string[] = [];

  // Check explicit escalation topics
  for (const topic of escalationTopics) {
    if (lowerContent.includes(topic.toLowerCase())) {
      matchedTopics.push(topic);
    }
  }

  // Check for money-related patterns
  const moneyPatterns = [
    /\$\d+/,
    /refund/i,
    /charge/i,
    /payment/i,
    /compensation/i,
    /reimburse/i,
    /discount/i,
    /fee/i,
    /cost/i,
    /price/i,
  ];

  for (const pattern of moneyPatterns) {
    if (pattern.test(content)) {
      if (!matchedTopics.includes('money')) {
        matchedTopics.push('money');
      }
      break;
    }
  }

  // Check for complaint patterns
  const complaintPatterns = [
    /complaint/i,
    /unacceptable/i,
    /manager/i,
    /supervisor/i,
    /terrible/i,
    /awful/i,
    /worst/i,
    /disappointed/i,
    /frustrated/i,
  ];

  for (const pattern of complaintPatterns) {
    if (pattern.test(content)) {
      if (!matchedTopics.includes('complaint')) {
        matchedTopics.push('complaint');
      }
      break;
    }
  }

  // Check sentiment for escalation indicators
  if (sentiment?.requiresEscalation) {
    if (!matchedTopics.includes('urgent')) {
      matchedTopics.push('urgent');
    }
  }

  if (sentiment?.primary === 'urgent' || sentiment?.primary === 'negative') {
    if (sentiment.intensity > 80) {
      if (!matchedTopics.includes('high-intensity')) {
        matchedTopics.push('high-intensity');
      }
    }
  }

  return {
    hasSensitive: matchedTopics.length > 0,
    matchedTopics,
  };
}

/**
 * Get property-specific AutoPilot settings or fall back to global
 */
export function getEffectiveAutoPilotSettings(
  globalSettings: AppSettings,
  propertySettings?: PropertyAutoPilotSettings
): {
  enabled: boolean;
  threshold: number;
  withinSchedule: boolean;
} {
  if (!propertySettings || propertySettings.useGlobalSchedule) {
    return {
      enabled: globalSettings.pilotMode === 'autopilot' && globalSettings.autoPilotEnabled,
      threshold: globalSettings.autoPilotConfidenceThreshold,
      withinSchedule: isWithinSchedule(globalSettings),
    };
  }

  // Use property-specific settings
  const withinSchedule = propertySettings.customScheduleDays && propertySettings.customScheduleStart && propertySettings.customScheduleEnd
    ? isWithinScheduleCustom(
        propertySettings.customScheduleDays,
        propertySettings.customScheduleStart,
        propertySettings.customScheduleEnd
      )
    : isWithinSchedule(globalSettings);

  return {
    enabled: propertySettings.enabled && globalSettings.pilotMode === 'autopilot',
    threshold: propertySettings.confidenceThreshold,
    withinSchedule,
  };
}

/**
 * Check custom schedule for property
 */
function isWithinScheduleCustom(days: number[], start: string, end: string): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (!days.includes(currentDay)) {
    return false;
  }

  if (start > end) {
    return currentTime >= start || currentTime <= end;
  }

  return currentTime >= start && currentTime <= end;
}

/**
 * Main decision function: Should AI draft be auto-sent or routed to CoPilot?
 */
export function makeAutoPilotDecision(
  confidence: ConfidenceScore,
  draftContent: string,
  guestMessageContent: string,
  settings: AppSettings,
  propertySettings?: PropertyAutoPilotSettings,
  sentiment?: SentimentAnalysis
): AutoPilotDecision {
  const warnings: string[] = [];

  // 1. Check if in CoPilot mode (always route for review)
  if (settings.pilotMode === 'copilot') {
    return {
      shouldAutoSend: false,
      action: 'routed_to_copilot',
      reason: 'CoPilot mode - manual review required',
      confidenceLevel: getConfidenceMeterConfig(confidence.overall).level,
      escalationRequired: false,
      blockedBySchedule: false,
      warnings: [],
    };
  }

  // 2. Get effective settings for this property
  const effectiveSettings = getEffectiveAutoPilotSettings(settings, propertySettings);

  // 3. Check if AutoPilot is enabled
  if (!effectiveSettings.enabled) {
    return {
      shouldAutoSend: false,
      action: 'routed_to_copilot',
      reason: 'AutoPilot disabled',
      confidenceLevel: getConfidenceMeterConfig(confidence.overall).level,
      escalationRequired: false,
      blockedBySchedule: false,
      warnings: [],
    };
  }

  // 4. Check schedule
  if (!effectiveSettings.withinSchedule) {
    return {
      shouldAutoSend: false,
      action: 'blocked_schedule',
      reason: 'Outside AutoPilot schedule hours',
      confidenceLevel: getConfidenceMeterConfig(confidence.overall).level,
      escalationRequired: false,
      blockedBySchedule: true,
      warnings: ['AutoPilot is scheduled for specific hours'],
    };
  }

  // 5. Check for sensitive topics (always escalate)
  if (settings.escalateSensitiveTopics) {
    const sensitiveCheck = containsSensitiveTopics(
      guestMessageContent + ' ' + draftContent,
      settings.escalationTopics,
      sentiment
    );

    if (sensitiveCheck.hasSensitive) {
      return {
        shouldAutoSend: false,
        action: 'escalated',
        reason: `Sensitive topic detected: ${sensitiveCheck.matchedTopics.join(', ')}`,
        confidenceLevel: getConfidenceMeterConfig(confidence.overall).level,
        escalationRequired: true,
        blockedBySchedule: false,
        warnings: [`Contains sensitive topics: ${sensitiveCheck.matchedTopics.join(', ')}`],
      };
    }
  }

  // 5.5. Check for negative sentiment escalation
  if (settings.escalateNegativeSentiment && sentiment) {
    const negativeSentiments = ['negative', 'urgent'];
    const negativeEmotions = ['frustrated', 'angry', 'anxious'];

    const hasNegativePrimary = negativeSentiments.includes(sentiment.primary);
    const hasNegativeEmotions = sentiment.emotions?.some(e => negativeEmotions.includes(e));

    if (hasNegativePrimary || hasNegativeEmotions || sentiment.requiresEscalation) {
      const sentimentReason = hasNegativePrimary
        ? sentiment.primary
        : hasNegativeEmotions
          ? sentiment.emotions.filter(e => negativeEmotions.includes(e)).join(', ')
          : 'requires escalation';
      return {
        shouldAutoSend: false,
        action: 'escalated',
        reason: `Negative guest sentiment detected: ${sentimentReason}`,
        confidenceLevel: getConfidenceMeterConfig(confidence.overall).level,
        escalationRequired: true,
        blockedBySchedule: false,
        warnings: [`Guest sentiment is ${sentimentReason} - requires manual review`],
      };
    }
  }

  // 6. Check AI confidence blocking
  if (confidence.blockedForAutoSend) {
    warnings.push(confidence.blockReason || 'AI flagged for manual review');
    return {
      shouldAutoSend: false,
      action: 'routed_to_copilot',
      reason: confidence.blockReason || 'AI flagged for manual review',
      confidenceLevel: getConfidenceMeterConfig(confidence.overall).level,
      escalationRequired: false,
      blockedBySchedule: false,
      warnings,
    };
  }

  // 7. Check confidence threshold
  if (confidence.overall < effectiveSettings.threshold) {
    return {
      shouldAutoSend: false,
      action: 'routed_to_copilot',
      reason: `Confidence ${confidence.overall}% below threshold ${effectiveSettings.threshold}%`,
      confidenceLevel: getConfidenceMeterConfig(confidence.overall).level,
      escalationRequired: false,
      blockedBySchedule: false,
      warnings: confidence.warnings,
    };
  }

  // 8. All checks passed - auto-send!
  return {
    shouldAutoSend: true,
    action: 'auto_sent',
    reason: `High confidence ${confidence.overall}% meets threshold ${effectiveSettings.threshold}%`,
    confidenceLevel: 'high',
    escalationRequired: false,
    blockedBySchedule: false,
    warnings: [],
  };
}

/**
 * Create an action log entry
 */
export function createActionLog(
  decision: AutoPilotDecision,
  conversation: Conversation,
  confidence: number,
  messagePreview: string
): AutoPilotActionLog {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    conversationId: conversation.id,
    guestName: conversation.guest.name,
    propertyId: conversation.property.id,
    propertyName: conversation.property.name,
    action: decision.action,
    reason: decision.reason,
    confidence,
    messagePreview: messagePreview.slice(0, 100) + (messagePreview.length > 100 ? '...' : ''),
  };
}

/**
 * Calculate accuracy from action logs
 */
export function calculateAutoPilotAccuracy(logs: AutoPilotActionLog[]): {
  totalDecisions: number;
  autoSentCount: number;
  escalatedCount: number;
  correctCount: number;
  incorrectCount: number;
  unratedCount: number;
  accuracyPercent: number;
} {
  const autoSent = logs.filter(l => l.action === 'auto_sent');
  const escalated = logs.filter(l => l.action === 'escalated');
  const rated = logs.filter(l => l.wasCorrect !== undefined);
  const correct = rated.filter(l => l.wasCorrect === true);
  const incorrect = rated.filter(l => l.wasCorrect === false);

  return {
    totalDecisions: logs.length,
    autoSentCount: autoSent.length,
    escalatedCount: escalated.length,
    correctCount: correct.length,
    incorrectCount: incorrect.length,
    unratedCount: logs.length - rated.length,
    accuracyPercent: rated.length > 0 ? Math.round((correct.length / rated.length) * 100) : 100,
  };
}

/**
 * Format schedule days for display
 */
export function formatScheduleDays(days: number[]): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Check for common patterns
  if (days.length === 7) return 'Every day';
  if (arraysEqual(days.sort(), [1, 2, 3, 4, 5])) return 'Weekdays';
  if (arraysEqual(days.sort(), [0, 6])) return 'Weekends';

  return days.map(d => dayNames[d]).join(', ');
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Get human-readable confidence description
 */
export function getConfidenceDescription(confidence: number): string {
  if (confidence >= 95) return 'Very high - AI is very confident';
  if (confidence >= 90) return 'High - Safe for auto-send';
  if (confidence >= 80) return 'Good - Review recommended';
  if (confidence >= 70) return 'Medium - Manual review needed';
  if (confidence >= 50) return 'Low - Requires editing';
  return 'Very low - Significant review needed';
}
