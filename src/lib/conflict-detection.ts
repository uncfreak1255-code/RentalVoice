// Conflict Detection Service
// Detects conflicts between knowledge base and recent messages
// Auto-detects outdated details and suggests fixes

import type { PropertyKnowledge, Message, Conversation } from './store';

export interface DetectedConflict {
  id: string;
  field: keyof PropertyKnowledge;
  fieldLabel: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: 'knowledge_internal' | 'message_mismatch' | 'outdated' | 'missing';
  currentValue?: string;
  suggestedValue?: string;
  suggestedFix: string;
  detectedAt: Date;
  messageId?: string;
  messageContent?: string;
}

export interface ConflictScanResult {
  conflicts: DetectedConflict[];
  scannedMessages: number;
  lastScanAt: Date;
  hasHighPriorityConflicts: boolean;
}

// Field label mapping for display
const FIELD_LABELS: Record<keyof PropertyKnowledge, string> = {
  propertyId: 'Property ID',
  propertyType: 'Property Type',
  wifiName: 'WiFi Network Name',
  wifiPassword: 'WiFi Password', // NOSONAR - this is a display label, not a credential
  checkInTime: 'Check-in Time',
  checkOutTime: 'Check-out Time',
  checkInInstructions: 'Check-in Instructions',
  checkOutInstructions: 'Check-out Instructions',
  parkingInfo: 'Parking Information',
  houseRules: 'House Rules',
  applianceGuide: 'Appliance Guide',
  localRecommendations: 'Local Recommendations',
  emergencyContacts: 'Emergency Contacts',
  customNotes: 'Custom Notes',
  tonePreference: 'Tone Preference',
  earlyCheckInAvailable: 'Early Check-in Available',
  earlyCheckInFee: 'Early Check-in Fee',
  lateCheckOutAvailable: 'Late Check-out Available',
  lateCheckOutFee: 'Late Check-out Fee',
  petsAllowed: 'Pets Allowed',
  petFee: 'Pet Fee',
  petFeeStructure: 'Pet Fee Structure',
  petRestrictions: 'Pet Restrictions',
  leaseStartDate: 'Lease Start Date',
  leaseEndDate: 'Lease End Date',
  monthlyRent: 'Monthly Rent',
  rentDueDay: 'Rent Due Day',
  lateFeeAmount: 'Late Fee Amount',
  lateFeeGracePeriod: 'Late Fee Grace Period',
  paymentMethods: 'Payment Methods',
  tenantPortalUrl: 'Tenant Portal URL',
  maintenanceContactName: 'Maintenance Contact Name',
  maintenanceContactPhone: 'Maintenance Contact Phone',
  maintenanceEmergencyPhone: 'Maintenance Emergency Phone',
  maintenanceHours: 'Maintenance Hours',
  quietHoursPolicy: 'Quiet Hours Policy',
  parkingPolicy: 'Parking Policy',
  petPolicy: 'Pet Policy',
  guestPolicy: 'Guest Policy',
  smokingPolicy: 'Smoking Policy',
  trashPolicy: 'Trash Policy',
  utilityResponsibility: 'Utility Responsibility',
};

// Patterns for extracting information from messages
const EXTRACTION_PATTERNS = {
  wifiPassword: [
    /wifi\s*(?:password|pass|code|key)[:\s]+["']?([^"'\n,]+)["']?/i,
    /password[:\s]+["']?([^"'\n,]+)["']?\s*(?:for\s*)?(?:wifi|internet)/i,
    /the\s*(?:wifi|internet)\s*(?:password|pass|code)\s*is[:\s]+["']?([^"'\n,]+)["']?/i,
  ],
  wifiName: [
    /wifi\s*(?:name|network|ssid)[:\s]+["']?([^"'\n,]+)["']?/i,
    /network\s*(?:name|called)[:\s]+["']?([^"'\n,]+)["']?/i,
    /connect\s*to[:\s]+["']?([^"'\n,]+)["']?\s*(?:wifi|network)/i,
  ],
  checkInTime: [
    /check[\s-]?in\s*(?:is\s*)?(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    /can\s*check[\s-]?in\s*(?:at\s*)?(?:after\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  ],
  checkOutTime: [
    /check[\s-]?out\s*(?:is\s*)?(?:at\s*)?(?:by\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    /(?:leave|depart)\s*(?:by\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  ],
  doorCode: [
    /(?:door|lock|entry|keypad)\s*code[:\s]+["']?(\d{4,6})["']?/i,
    /code\s*(?:is|for\s*(?:the\s*)?door)[:\s]+["']?(\d{4,6})["']?/i,
    /(?:enter|type)\s*["']?(\d{4,6})["']?\s*(?:on|into|at)\s*(?:the\s*)?(?:door|keypad)/i,
  ],
  parkingInfo: [
    /park(?:ing)?\s*(?:is\s*)?(?:at|in|on)[:\s]+["']?([^"'\n.]+)["']?/i,
    /(?:your|the)\s*parking\s*(?:spot|space|area)\s*(?:is\s*)?(?:at|in|on)?[:\s]+["']?([^"'\n.]+)["']?/i,
  ],
};

// Scan knowledge base for internal conflicts
export function scanKnowledgeBaseConflicts(knowledge: PropertyKnowledge): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const now = new Date();

  // Check for incomplete WiFi info
  if (knowledge.wifiName && !knowledge.wifiPassword) {
    conflicts.push({
      id: `conflict-${Date.now()}-wifi-incomplete`,
      field: 'wifiPassword',
      fieldLabel: FIELD_LABELS.wifiPassword,
      issue: 'WiFi network name is set but password is missing',
      severity: 'high',
      source: 'missing',
      currentValue: undefined,
      suggestedFix: 'Add WiFi password to property knowledge',
      detectedAt: now,
    });
  }

  // Check for incomplete check-in info
  if (knowledge.checkInTime && !knowledge.checkInInstructions) {
    conflicts.push({
      id: `conflict-${Date.now()}-checkin-incomplete`,
      field: 'checkInInstructions',
      fieldLabel: FIELD_LABELS.checkInInstructions,
      issue: 'Check-in time is set but detailed instructions are missing',
      severity: 'medium',
      source: 'missing',
      currentValue: undefined,
      suggestedFix: 'Add detailed check-in instructions for guests',
      detectedAt: now,
    });
  }

  // Check for outdated year references
  const currentYear = now.getFullYear();
  const oldYears = [currentYear - 1, currentYear - 2, currentYear - 3];

  Object.entries(knowledge).forEach(([key, value]) => {
    if (typeof value === 'string') {
      for (const oldYear of oldYears) {
        if (value.includes(String(oldYear))) {
          conflicts.push({
            id: `conflict-${Date.now()}-${key}-outdated`,
            field: key as keyof PropertyKnowledge,
            fieldLabel: FIELD_LABELS[key as keyof PropertyKnowledge] || key,
            issue: `Contains reference to ${oldYear} which may be outdated`,
            severity: 'low',
            source: 'outdated',
            currentValue: value,
            suggestedFix: `Review and update any outdated ${oldYear} references`,
            detectedAt: now,
          });
          break;
        }
      }
    }
  });

  // Check for time inconsistencies
  if (knowledge.checkInInstructions && knowledge.checkInTime) {
    const timeMatch = knowledge.checkInInstructions.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\b/);
    if (timeMatch) {
      const mentionedTime = normalizeTime(timeMatch[0]);
      const setTime = normalizeTime(knowledge.checkInTime);
      if (mentionedTime && setTime && mentionedTime !== setTime) {
        conflicts.push({
          id: `conflict-${Date.now()}-checkin-time-mismatch`,
          field: 'checkInTime',
          fieldLabel: FIELD_LABELS.checkInTime,
          issue: `Instructions mention ${timeMatch[0]} but check-in time is set to ${knowledge.checkInTime}`,
          severity: 'medium',
          source: 'knowledge_internal',
          currentValue: knowledge.checkInTime,
          suggestedValue: timeMatch[0],
          suggestedFix: `Update check-in time to match instructions, or update instructions to match ${knowledge.checkInTime}`,
          detectedAt: now,
        });
      }
    }
  }

  // Check for check-out time inconsistencies
  if (knowledge.checkOutInstructions && knowledge.checkOutTime) {
    const timeMatch = knowledge.checkOutInstructions.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\b/);
    if (timeMatch) {
      const mentionedTime = normalizeTime(timeMatch[0]);
      const setTime = normalizeTime(knowledge.checkOutTime);
      if (mentionedTime && setTime && mentionedTime !== setTime) {
        conflicts.push({
          id: `conflict-${Date.now()}-checkout-time-mismatch`,
          field: 'checkOutTime',
          fieldLabel: FIELD_LABELS.checkOutTime,
          issue: `Instructions mention ${timeMatch[0]} but check-out time is set to ${knowledge.checkOutTime}`,
          severity: 'medium',
          source: 'knowledge_internal',
          currentValue: knowledge.checkOutTime,
          suggestedValue: timeMatch[0],
          suggestedFix: `Update check-out time to match instructions, or update instructions to match ${knowledge.checkOutTime}`,
          detectedAt: now,
        });
      }
    }
  }

  return conflicts;
}

// Scan messages for conflicts with knowledge base
export function scanMessagesForConflicts(
  knowledge: PropertyKnowledge,
  messages: Message[],
  maxMessages: number = 50
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const now = new Date();

  // Only check host messages (where they might have given different info)
  const hostMessages = messages
    .filter(m => m.sender === 'host')
    .slice(-maxMessages);

  for (const message of hostMessages) {
    const content = message.content;

    // Check for WiFi password mismatches
    if (knowledge.wifiPassword) {
      for (const pattern of EXTRACTION_PATTERNS.wifiPassword) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const extractedPassword = match[1].trim();
          if (extractedPassword.toLowerCase() !== knowledge.wifiPassword.toLowerCase() &&
              extractedPassword.length > 3) {
            conflicts.push({
              id: `conflict-${message.id}-wifi-password`,
              field: 'wifiPassword',
              fieldLabel: FIELD_LABELS.wifiPassword,
              issue: `Message contains different WiFi password than knowledge base`,
              severity: 'high',
              source: 'message_mismatch',
              currentValue: knowledge.wifiPassword,
              suggestedValue: extractedPassword,
              suggestedFix: `Update WiFi password to "${extractedPassword}"`,
              detectedAt: now,
              messageId: message.id,
              messageContent: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            });
            break;
          }
        }
      }
    }

    // Check for WiFi name mismatches
    if (knowledge.wifiName) {
      for (const pattern of EXTRACTION_PATTERNS.wifiName) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const extractedName = match[1].trim();
          if (extractedName.toLowerCase() !== knowledge.wifiName.toLowerCase() &&
              extractedName.length > 2) {
            conflicts.push({
              id: `conflict-${message.id}-wifi-name`,
              field: 'wifiName',
              fieldLabel: FIELD_LABELS.wifiName,
              issue: `Message contains different WiFi network name than knowledge base`,
              severity: 'medium',
              source: 'message_mismatch',
              currentValue: knowledge.wifiName,
              suggestedValue: extractedName,
              suggestedFix: `Update WiFi network name to "${extractedName}"`,
              detectedAt: now,
              messageId: message.id,
              messageContent: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            });
            break;
          }
        }
      }
    }

    // Check for check-in time mismatches
    if (knowledge.checkInTime) {
      for (const pattern of EXTRACTION_PATTERNS.checkInTime) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const extractedTime = normalizeTime(match[1]);
          const knowledgeTime = normalizeTime(knowledge.checkInTime);
          if (extractedTime && knowledgeTime && extractedTime !== knowledgeTime) {
            conflicts.push({
              id: `conflict-${message.id}-checkin-time`,
              field: 'checkInTime',
              fieldLabel: FIELD_LABELS.checkInTime,
              issue: `Message mentions different check-in time than knowledge base`,
              severity: 'medium',
              source: 'message_mismatch',
              currentValue: knowledge.checkInTime,
              suggestedValue: match[1].trim(),
              suggestedFix: `Update check-in time to "${match[1].trim()}"`,
              detectedAt: now,
              messageId: message.id,
              messageContent: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            });
            break;
          }
        }
      }
    }

    // Check for check-out time mismatches
    if (knowledge.checkOutTime) {
      for (const pattern of EXTRACTION_PATTERNS.checkOutTime) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const extractedTime = normalizeTime(match[1]);
          const knowledgeTime = normalizeTime(knowledge.checkOutTime);
          if (extractedTime && knowledgeTime && extractedTime !== knowledgeTime) {
            conflicts.push({
              id: `conflict-${message.id}-checkout-time`,
              field: 'checkOutTime',
              fieldLabel: FIELD_LABELS.checkOutTime,
              issue: `Message mentions different check-out time than knowledge base`,
              severity: 'medium',
              source: 'message_mismatch',
              currentValue: knowledge.checkOutTime,
              suggestedValue: match[1].trim(),
              suggestedFix: `Update check-out time to "${match[1].trim()}"`,
              detectedAt: now,
              messageId: message.id,
              messageContent: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            });
            break;
          }
        }
      }
    }

    // Check for door code patterns (commonly change)
    for (const pattern of EXTRACTION_PATTERNS.doorCode) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const extractedCode = match[1];
        // Check if this code is mentioned in check-in instructions
        if (knowledge.checkInInstructions && !knowledge.checkInInstructions.includes(extractedCode)) {
          conflicts.push({
            id: `conflict-${message.id}-door-code`,
            field: 'checkInInstructions',
            fieldLabel: 'Door/Lock Code',
            issue: `Message mentions door code "${extractedCode}" which isn't in check-in instructions`,
            severity: 'high',
            source: 'message_mismatch',
            currentValue: knowledge.checkInInstructions,
            suggestedValue: extractedCode,
            suggestedFix: `Update check-in instructions to include door code "${extractedCode}"`,
            detectedAt: now,
            messageId: message.id,
            messageContent: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          });
          break;
        }
      }
    }
  }

  // Deduplicate conflicts (same field from multiple messages)
  const deduped = deduplicateConflicts(conflicts);

  return deduped;
}

// Full scan combining knowledge base and message analysis
export function runFullConflictScan(
  knowledge: PropertyKnowledge,
  conversations: Conversation[]
): ConflictScanResult {
  const now = new Date();
  const allConflicts: DetectedConflict[] = [];

  // Scan knowledge base internal conflicts
  const internalConflicts = scanKnowledgeBaseConflicts(knowledge);
  allConflicts.push(...internalConflicts);

  // Scan all conversations for message-based conflicts
  let totalMessages = 0;
  for (const conversation of conversations) {
    if (conversation.property.id === knowledge.propertyId) {
      const messageConflicts = scanMessagesForConflicts(knowledge, conversation.messages, 20);
      allConflicts.push(...messageConflicts);
      totalMessages += conversation.messages.length;
    }
  }

  // Deduplicate and sort by severity
  const dedupedConflicts = deduplicateConflicts(allConflicts);
  const sortedConflicts = sortConflictsBySeverity(dedupedConflicts);

  return {
    conflicts: sortedConflicts,
    scannedMessages: totalMessages,
    lastScanAt: now,
    hasHighPriorityConflicts: sortedConflicts.some(c =>
      c.severity === 'high' || c.severity === 'critical'
    ),
  };
}

// Quick scan for just one conversation
export function quickConflictScan(
  knowledge: PropertyKnowledge,
  conversation: Conversation
): DetectedConflict[] {
  const internalConflicts = scanKnowledgeBaseConflicts(knowledge);
  const messageConflicts = scanMessagesForConflicts(knowledge, conversation.messages, 10);

  const allConflicts = [...internalConflicts, ...messageConflicts];
  return sortConflictsBySeverity(deduplicateConflicts(allConflicts));
}

// Helper: Normalize time format for comparison
function normalizeTime(timeStr: string): string | null {
  if (!timeStr) return null;

  const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toLowerCase();

  // Convert to 24-hour format for comparison
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper: Deduplicate conflicts (keep most recent per field)
function deduplicateConflicts(conflicts: DetectedConflict[]): DetectedConflict[] {
  const byField = new Map<string, DetectedConflict>();

  for (const conflict of conflicts) {
    const key = `${conflict.field}-${conflict.source}`;
    const existing = byField.get(key);

    // Keep the higher severity or more recent
    if (!existing ||
        getSeverityOrder(conflict.severity) > getSeverityOrder(existing.severity) ||
        conflict.detectedAt > existing.detectedAt) {
      byField.set(key, conflict);
    }
  }

  return Array.from(byField.values());
}

// Helper: Sort conflicts by severity
function sortConflictsBySeverity(conflicts: DetectedConflict[]): DetectedConflict[] {
  return [...conflicts].sort((a, b) =>
    getSeverityOrder(b.severity) - getSeverityOrder(a.severity)
  );
}

// Helper: Get numeric severity order
function getSeverityOrder(severity: DetectedConflict['severity']): number {
  const order = { critical: 4, high: 3, medium: 2, low: 1 };
  return order[severity] || 0;
}

// Generate quick fix updates for PropertyKnowledge
export function generateQuickFix(
  conflict: DetectedConflict
): Partial<PropertyKnowledge> | null {
  if (!conflict.suggestedValue) return null;

  const updates: Partial<PropertyKnowledge> = {};

  switch (conflict.field) {
    case 'wifiPassword':
      updates.wifiPassword = conflict.suggestedValue;
      break;
    case 'wifiName':
      updates.wifiName = conflict.suggestedValue;
      break;
    case 'checkInTime':
      updates.checkInTime = conflict.suggestedValue;
      break;
    case 'checkOutTime':
      updates.checkOutTime = conflict.suggestedValue;
      break;
    // For complex fields like instructions, we can't auto-fix
    default:
      return null;
  }

  return updates;
}
