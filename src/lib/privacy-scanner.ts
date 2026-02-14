/**
 * Privacy Scanner Service
 * Detects and anonymizes sensitive data in message drafts
 */

// Types for sensitive data detection
export interface SensitiveDataMatch {
  type: SensitiveDataType;
  value: string;
  startIndex: number;
  endIndex: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string; // Anonymized replacement
}

export type SensitiveDataType =
  | 'credit_card'
  | 'ssn'
  | 'phone_number'
  | 'email'
  | 'address'
  | 'passport'
  | 'drivers_license'
  | 'bank_account'
  | 'date_of_birth'
  | 'ip_address'
  | 'password'
  | 'api_key'
  | 'wifi_password'
  | 'door_code'
  | 'personal_id';

export interface ScanResult {
  hasIssues: boolean;
  totalMatches: number;
  matches: SensitiveDataMatch[];
  riskScore: number; // 0-100
  anonymizedText: string;
  recommendations: string[];
}

export interface PrivacyScanSettings {
  enableAutoScan: boolean;
  autoAnonymize: boolean;
  sensitivityLevel: 'low' | 'medium' | 'high';
  customPatterns: Array<{
    name: string;
    pattern: string;
    severity: SensitiveDataMatch['severity'];
  }>;
  excludedTypes: SensitiveDataType[];
}

// Regular expressions for sensitive data detection
const PATTERNS: Record<SensitiveDataType, { regex: RegExp; severity: SensitiveDataMatch['severity']; label: string }> = {
  credit_card: {
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    severity: 'critical',
    label: 'Credit Card Number',
  },
  ssn: {
    regex: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
    severity: 'critical',
    label: 'Social Security Number',
  },
  phone_number: {
    regex: /\b(?:\+?1[-.\s]?)?(?:\(?[2-9][0-9]{2}\)?[-.\s]?)?[2-9][0-9]{2}[-.\s]?[0-9]{4}\b/g,
    severity: 'medium',
    label: 'Phone Number',
  },
  email: {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'medium',
    label: 'Email Address',
  },
  address: {
    regex: /\b\d{1,5}\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|circle|cir)\.?\s*(?:,?\s*(?:apt|apartment|unit|suite|ste|#)\s*\d+[a-z]?)?\s*,?\s*[a-z\s]+,?\s*[a-z]{2}\s*\d{5}(?:-\d{4})?\b/gi,
    severity: 'medium',
    label: 'Street Address',
  },
  passport: {
    regex: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
    severity: 'critical',
    label: 'Passport Number',
  },
  drivers_license: {
    regex: /\b[A-Z]{1,2}\d{5,8}\b/g,
    severity: 'high',
    label: 'Driver\'s License',
  },
  bank_account: {
    regex: /\b\d{8,17}\b/g,
    severity: 'critical',
    label: 'Bank Account Number',
  },
  date_of_birth: {
    regex: /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12][0-9]|3[01])\b/g,
    severity: 'medium',
    label: 'Date of Birth',
  },
  ip_address: {
    regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: 'low',
    label: 'IP Address',
  },
  password: {
    regex: /(?:password|passwd|pwd|passcode|pin)[\s:=]+["']?([^\s"']{4,})["']?/gi,
    severity: 'critical',
    label: 'Password',
  },
  api_key: {
    regex: /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)[\s:=]+["']?([a-zA-Z0-9_-]{20,})["']?/gi,
    severity: 'critical',
    label: 'API Key',
  },
  wifi_password: {
    regex: /(?:wifi|wi-fi|wireless)[\s_-]*(?:password|pass|pwd|key)[\s:=]+["']?([^\s"'\n]{4,})["']?/gi,
    severity: 'high',
    label: 'WiFi Password',
  },
  door_code: {
    regex: /(?:door|gate|entry|lock|access)[\s_-]*(?:code|pin|password)[\s:=]+["']?(\d{4,8})["']?/gi,
    severity: 'high',
    label: 'Door/Access Code',
  },
  personal_id: {
    regex: /\b(?:id|identification)[\s#:]+([A-Z0-9]{6,12})\b/gi,
    severity: 'high',
    label: 'Personal ID',
  },
};

// Severity weights for risk calculation
const SEVERITY_WEIGHTS: Record<SensitiveDataMatch['severity'], number> = {
  low: 10,
  medium: 25,
  high: 50,
  critical: 100,
};

// Generate anonymized replacement based on data type
function getAnonymizedValue(type: SensitiveDataType, originalValue: string): string {
  const length = originalValue.length;

  switch (type) {
    case 'credit_card':
      return `****-****-****-${originalValue.slice(-4)}`;
    case 'ssn':
      return '***-**-****';
    case 'phone_number':
      return `(***) ***-${originalValue.slice(-4)}`;
    case 'email':
      const atIndex = originalValue.indexOf('@');
      if (atIndex > 2) {
        return `${originalValue[0]}***@${originalValue.slice(atIndex + 1)}`;
      }
      return '***@***.***';
    case 'address':
      return '[Address Redacted]';
    case 'passport':
      return `**${originalValue.slice(-4)}`;
    case 'drivers_license':
      return `**${originalValue.slice(-4)}`;
    case 'bank_account':
      return `****${originalValue.slice(-4)}`;
    case 'date_of_birth':
      return '[DOB Redacted]';
    case 'ip_address':
      return 'xxx.xxx.xxx.xxx';
    case 'password':
      return '[Password Hidden]';
    case 'api_key':
      return '[API Key Redacted]';
    case 'wifi_password':
      return '[WiFi Password Hidden]';
    case 'door_code':
      return '[Code Hidden]';
    case 'personal_id':
      return `ID: ***${originalValue.slice(-3)}`;
    default:
      return '*'.repeat(Math.min(length, 10));
  }
}

// Main scanning function
export function scanForSensitiveData(
  text: string,
  settings?: Partial<PrivacyScanSettings>
): ScanResult {
  const excludedTypes = settings?.excludedTypes || [];
  const sensitivityLevel = settings?.sensitivityLevel || 'medium';
  const matches: SensitiveDataMatch[] = [];

  // Sensitivity level determines which severities to report
  const minSeverity: Record<string, SensitiveDataMatch['severity'][]> = {
    low: ['critical'],
    medium: ['critical', 'high'],
    high: ['critical', 'high', 'medium', 'low'],
  };

  const activeSeverities = minSeverity[sensitivityLevel];

  // Scan with each pattern
  for (const [type, config] of Object.entries(PATTERNS)) {
    const dataType = type as SensitiveDataType;

    // Skip excluded types
    if (excludedTypes.includes(dataType)) continue;

    // Skip severities below threshold
    if (!activeSeverities.includes(config.severity)) continue;

    // Reset regex lastIndex
    config.regex.lastIndex = 0;

    let match;
    while ((match = config.regex.exec(text)) !== null) {
      // For patterns that capture groups (like password), use the captured group
      const value = match[1] || match[0];
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;

      // Avoid duplicate matches at same position
      const isDuplicate = matches.some(
        m => m.startIndex === startIndex && m.endIndex === endIndex
      );

      if (!isDuplicate) {
        matches.push({
          type: dataType,
          value: match[0],
          startIndex,
          endIndex,
          severity: config.severity,
          suggestion: getAnonymizedValue(dataType, value),
        });
      }
    }
  }

  // Scan custom patterns if provided
  if (settings?.customPatterns) {
    for (const custom of settings.customPatterns) {
      try {
        const regex = new RegExp(custom.pattern, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            type: 'personal_id', // Use generic type for custom
            value: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            severity: custom.severity,
            suggestion: '[Custom Redacted]',
          });
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.startIndex - b.startIndex);

  // Calculate risk score
  const riskScore = Math.min(
    100,
    matches.reduce((acc, m) => acc + SEVERITY_WEIGHTS[m.severity], 0)
  );

  // Generate anonymized text
  let anonymizedText = text;
  // Process matches in reverse order to preserve indices
  const reversedMatches = [...matches].reverse();
  for (const match of reversedMatches) {
    anonymizedText =
      anonymizedText.slice(0, match.startIndex) +
      match.suggestion +
      anonymizedText.slice(match.endIndex);
  }

  // Generate recommendations
  const recommendations: string[] = [];

  const criticalCount = matches.filter(m => m.severity === 'critical').length;
  const highCount = matches.filter(m => m.severity === 'high').length;

  if (criticalCount > 0) {
    recommendations.push(`Remove ${criticalCount} critical item(s) before sending`);
  }
  if (highCount > 0) {
    recommendations.push(`Review ${highCount} high-sensitivity item(s)`);
  }
  if (matches.some(m => m.type === 'credit_card')) {
    recommendations.push('Never share credit card numbers in messages');
  }
  if (matches.some(m => m.type === 'password' || m.type === 'wifi_password')) {
    recommendations.push('Consider using a secure sharing method for passwords');
  }
  if (matches.some(m => m.type === 'door_code')) {
    recommendations.push('Door codes should only be shared with verified guests');
  }

  return {
    hasIssues: matches.length > 0,
    totalMatches: matches.length,
    matches,
    riskScore,
    anonymizedText,
    recommendations,
  };
}

// Auto-anonymize function
export function anonymizeText(text: string, settings?: Partial<PrivacyScanSettings>): string {
  const result = scanForSensitiveData(text, settings);
  return result.anonymizedText;
}

// Check if specific text contains sensitive data
export function hasSensitiveData(text: string, settings?: Partial<PrivacyScanSettings>): boolean {
  const result = scanForSensitiveData(text, settings);
  return result.hasIssues;
}

// Get human-readable label for data type
export function getDataTypeLabel(type: SensitiveDataType): string {
  return PATTERNS[type]?.label || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Get severity color for UI
export function getSeverityColor(severity: SensitiveDataMatch['severity']): string {
  switch (severity) {
    case 'critical':
      return '#EF4444'; // red-500
    case 'high':
      return '#F97316'; // orange-500
    case 'medium':
      return '#F59E0B'; // amber-500
    case 'low':
      return '#3B82F6'; // blue-500
    default:
      return '#64748B'; // slate-500
  }
}

// Get severity background color for UI
export function getSeverityBgColor(severity: SensitiveDataMatch['severity']): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20';
    case 'high':
      return 'bg-orange-500/20';
    case 'medium':
      return 'bg-amber-500/20';
    case 'low':
      return 'bg-blue-500/20';
    default:
      return 'bg-slate-500/20';
  }
}

// Default privacy settings
export const DEFAULT_PRIVACY_SETTINGS: PrivacyScanSettings = {
  enableAutoScan: true,
  autoAnonymize: false,
  sensitivityLevel: 'medium',
  customPatterns: [],
  excludedTypes: [],
};
