// Proactive Messaging Service
// Detects when the host should send messages proactively

import type { Conversation, Property } from './store';
import { differenceInHours, differenceInDays, isAfter, isBefore, addDays, parseISO } from 'date-fns';

export type AlertType =
  | 'missing_check_in_instructions'
  | 'no_response_to_guest'
  | 'check_in_approaching'
  | 'checkout_approaching'
  | 'review_request_timing'
  | 'unanswered_question'
  | 'follow_up_needed'
  | 'booking_inquiry_stale'
  | 'guest_issue_unresolved';

export type AlertPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProactiveAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  conversationId: string;
  propertyId: string;
  guestName: string;

  // Alert details
  title: string;
  message: string;
  suggestedAction: string;

  // Timing
  createdAt: Date;
  expiresAt?: Date;
  isDismissed: boolean;

  // Context
  daysUntilCheckIn?: number;
  daysUntilCheckOut?: number;
  hoursSinceLastGuestMessage?: number;
  hoursSinceLastHostMessage?: number;
}

/**
 * Analyze a conversation and generate proactive alerts
 */
export function analyzeConversationForAlerts(conversation: Conversation): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const now = new Date();

  const {
    id: conversationId,
    property,
    guest,
    checkInDate,
    checkOutDate,
    messages,
  } = conversation;

  // Find last messages
  const lastGuestMessage = [...messages].reverse().find(m => m.sender === 'guest');
  const lastHostMessage = [...messages].reverse().find(m => m.sender === 'host');
  const lastMessageOverall = messages[messages.length - 1];

  // Calculate time differences
  const hoursSinceLastGuest = lastGuestMessage
    ? differenceInHours(now, new Date(lastGuestMessage.timestamp))
    : null;

  const hoursSinceLastHost = lastHostMessage
    ? differenceInHours(now, new Date(lastHostMessage.timestamp))
    : null;

  // Check-in date analysis
  const checkIn = checkInDate ? new Date(checkInDate) : null;
  const checkOut = checkOutDate ? new Date(checkOutDate) : null;
  const daysUntilCheckIn = checkIn ? differenceInDays(checkIn, now) : null;
  const daysUntilCheckOut = checkOut ? differenceInDays(checkOut, now) : null;

  // ============================================
  // ALERT: No Response to Guest
  // ============================================
  if (
    lastMessageOverall?.sender === 'guest' &&
    hoursSinceLastGuest !== null &&
    hoursSinceLastGuest >= 2
  ) {
    let priority: AlertPriority = 'medium';
    let title = 'Guest awaiting response';

    if (hoursSinceLastGuest >= 24) {
      priority = 'urgent';
      title = 'Guest waiting over 24 hours!';
    } else if (hoursSinceLastGuest >= 8) {
      priority = 'high';
      title = 'Guest waiting over 8 hours';
    }

    alerts.push({
      id: `alert_${conversationId}_no_response`,
      type: 'no_response_to_guest',
      priority,
      conversationId,
      propertyId: property.id,
      guestName: guest.name,
      title,
      message: `${guest.name} sent a message ${Math.round(hoursSinceLastGuest)} hours ago with no reply`,
      suggestedAction: 'Review and respond to the guest message',
      createdAt: now,
      isDismissed: false,
      hoursSinceLastGuestMessage: hoursSinceLastGuest,
    });
  }

  // ============================================
  // ALERT: Check-in Approaching Without Instructions
  // ============================================
  if (daysUntilCheckIn !== null && daysUntilCheckIn <= 2 && daysUntilCheckIn >= 0) {
    // Check if check-in instructions were sent
    const allHostMessages = messages.filter(m => m.sender === 'host').map(m => m.content.toLowerCase());
    const hasCheckInInstructions = allHostMessages.some(content =>
      /check.?in|arrival|door code|key|lockbox|access|parking|wifi|password/i.test(content)
    );

    if (!hasCheckInInstructions) {
      alerts.push({
        id: `alert_${conversationId}_check_in_instructions`,
        type: 'missing_check_in_instructions',
        priority: daysUntilCheckIn === 0 ? 'urgent' : 'high',
        conversationId,
        propertyId: property.id,
        guestName: guest.name,
        title: daysUntilCheckIn === 0 ? 'Check-in TODAY - No instructions sent!' : 'Check-in instructions needed',
        message: `${guest.name} checks in ${daysUntilCheckIn === 0 ? 'TODAY' : `in ${daysUntilCheckIn} day(s)`} but hasn't received check-in details`,
        suggestedAction: 'Send check-in instructions with door code, WiFi, and arrival info',
        createdAt: now,
        isDismissed: false,
        daysUntilCheckIn,
      });
    } else if (daysUntilCheckIn === 0) {
      // Check-in day reminder
      alerts.push({
        id: `alert_${conversationId}_check_in_today`,
        type: 'check_in_approaching',
        priority: 'medium',
        conversationId,
        propertyId: property.id,
        guestName: guest.name,
        title: 'Guest checking in today',
        message: `${guest.name} is arriving today. Consider sending a welcome message.`,
        suggestedAction: 'Send a friendly "looking forward to hosting you" message',
        createdAt: now,
        isDismissed: false,
        daysUntilCheckIn,
      });
    }
  }

  // ============================================
  // ALERT: Checkout Approaching (Review Request)
  // ============================================
  if (daysUntilCheckOut !== null && daysUntilCheckOut === 0) {
    alerts.push({
      id: `alert_${conversationId}_checkout`,
      type: 'checkout_approaching',
      priority: 'low',
      conversationId,
      propertyId: property.id,
      guestName: guest.name,
      title: 'Guest checking out today',
      message: `${guest.name} is checking out today`,
      suggestedAction: 'Send a thank-you message and ask for a review',
      createdAt: now,
      isDismissed: false,
      daysUntilCheckOut,
    });
  }

  // ============================================
  // ALERT: Post-Checkout Review Request
  // ============================================
  if (daysUntilCheckOut !== null && daysUntilCheckOut < 0 && daysUntilCheckOut >= -2) {
    // Check if review request was sent
    const hasReviewRequest = messages.some(m =>
      m.sender === 'host' &&
      /review|feedback|rating|5.?star/i.test(m.content)
    );

    if (!hasReviewRequest) {
      alerts.push({
        id: `alert_${conversationId}_review_request`,
        type: 'review_request_timing',
        priority: 'medium',
        conversationId,
        propertyId: property.id,
        guestName: guest.name,
        title: 'Good time for review request',
        message: `${guest.name} checked out ${Math.abs(daysUntilCheckOut)} day(s) ago - optimal time for review request`,
        suggestedAction: 'Send a friendly message thanking them and asking for a review',
        createdAt: now,
        isDismissed: false,
        daysUntilCheckOut,
      });
    }
  }

  // ============================================
  // ALERT: Unanswered Question
  // ============================================
  if (lastGuestMessage) {
    const hasQuestion = /\?|can you|could you|is there|where|when|how|what|do you|does the/i.test(
      lastGuestMessage.content
    );

    const wasAnswered = lastHostMessage &&
      new Date(lastHostMessage.timestamp) > new Date(lastGuestMessage.timestamp);

    if (hasQuestion && !wasAnswered) {
      alerts.push({
        id: `alert_${conversationId}_unanswered_question`,
        type: 'unanswered_question',
        priority: hoursSinceLastGuest && hoursSinceLastGuest >= 4 ? 'high' : 'medium',
        conversationId,
        propertyId: property.id,
        guestName: guest.name,
        title: 'Unanswered question',
        message: `${guest.name} asked a question that hasn't been answered`,
        suggestedAction: 'Review and answer the guest\'s question',
        createdAt: now,
        isDismissed: false,
        hoursSinceLastGuestMessage: hoursSinceLastGuest ?? undefined,
      });
    }
  }

  // ============================================
  // ALERT: Guest Issue Unresolved
  // ============================================
  if (lastGuestMessage) {
    const hasIssue = /broken|not working|doesn't work|problem|issue|complaint|cold|hot|dirty|noise|smell|leak|bug|insect/i.test(
      lastGuestMessage.content
    );

    if (hasIssue && hoursSinceLastGuest && hoursSinceLastGuest >= 1) {
      // Check if host acknowledged/resolved
      const hostResponseAfter = lastHostMessage &&
        new Date(lastHostMessage.timestamp) > new Date(lastGuestMessage.timestamp);

      if (!hostResponseAfter) {
        alerts.push({
          id: `alert_${conversationId}_guest_issue`,
          type: 'guest_issue_unresolved',
          priority: 'urgent',
          conversationId,
          propertyId: property.id,
          guestName: guest.name,
          title: 'Guest reported an issue!',
          message: `${guest.name} reported a problem that needs attention`,
          suggestedAction: 'Respond immediately to acknowledge and resolve the issue',
          createdAt: now,
          isDismissed: false,
          hoursSinceLastGuestMessage: hoursSinceLastGuest,
        });
      }
    }
  }

  return alerts;
}

/**
 * Analyze all conversations and get prioritized alerts
 */
export function getAllProactiveAlerts(conversations: Conversation[]): ProactiveAlert[] {
  const allAlerts: ProactiveAlert[] = [];

  for (const conversation of conversations) {
    const alerts = analyzeConversationForAlerts(conversation);
    allAlerts.push(...alerts);
  }

  // Sort by priority (urgent first) then by creation time
  const priorityOrder: Record<AlertPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  allAlerts.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return allAlerts;
}

/**
 * Get urgent alerts count
 */
export function getUrgentAlertsCount(alerts: ProactiveAlert[]): number {
  return alerts.filter(a => a.priority === 'urgent' && !a.isDismissed).length;
}

/**
 * Get high priority alerts count
 */
export function getHighPriorityAlertsCount(alerts: ProactiveAlert[]): number {
  return alerts.filter(a => (a.priority === 'urgent' || a.priority === 'high') && !a.isDismissed).length;
}

/**
 * Get alert icon based on type
 */
export function getAlertIcon(type: AlertType): string {
  switch (type) {
    case 'no_response_to_guest':
      return 'message-circle';
    case 'missing_check_in_instructions':
      return 'key';
    case 'check_in_approaching':
      return 'calendar-check';
    case 'checkout_approaching':
      return 'calendar-x';
    case 'review_request_timing':
      return 'star';
    case 'unanswered_question':
      return 'help-circle';
    case 'guest_issue_unresolved':
      return 'alert-triangle';
    default:
      return 'bell';
  }
}

/**
 * Get alert color based on priority
 */
export function getAlertColor(priority: AlertPriority): string {
  switch (priority) {
    case 'urgent':
      return '#EF4444'; // red-500
    case 'high':
      return '#F97316'; // orange-500
    case 'medium':
      return '#EAB308'; // yellow-500
    case 'low':
      return '#6B7280'; // gray-500
  }
}
