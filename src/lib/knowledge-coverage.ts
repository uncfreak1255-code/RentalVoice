// Knowledge Coverage Analysis Service
// Analyzes historical guest questions vs knowledge base and template matches
// Identifies gaps and suggests improvements

import type { Message, Conversation, QuickReplyTemplate, PropertyKnowledge } from './store';

// Question category for analysis
export interface QuestionCategory {
  id: string;
  name: string;
  keywords: string[];
  relatedKnowledgeFields: (keyof PropertyKnowledge)[];
  templateCategories: string[];
}

// Standard question categories for vacation rentals
export const QUESTION_CATEGORIES: QuestionCategory[] = [
  {
    id: 'wifi',
    name: 'WiFi & Internet',
    keywords: ['wifi', 'wi-fi', 'internet', 'password', 'network', 'connect', 'online'],
    relatedKnowledgeFields: ['wifiName', 'wifiPassword'],
    templateCategories: ['wifi'],
  },
  {
    id: 'checkin',
    name: 'Check-in',
    keywords: ['check-in', 'checkin', 'check in', 'arrive', 'arrival', 'key', 'access', 'door', 'code', 'lockbox', 'entry'],
    relatedKnowledgeFields: ['checkInInstructions', 'checkInTime'],
    templateCategories: ['check_in'],
  },
  {
    id: 'checkout',
    name: 'Check-out',
    keywords: ['check-out', 'checkout', 'check out', 'leave', 'leaving', 'departure', 'depart'],
    relatedKnowledgeFields: ['checkOutInstructions', 'checkOutTime'],
    templateCategories: ['check_out'],
  },
  {
    id: 'parking',
    name: 'Parking',
    keywords: ['park', 'parking', 'car', 'garage', 'driveway', 'vehicle', 'street parking'],
    relatedKnowledgeFields: ['parkingInfo'],
    templateCategories: ['parking'],
  },
  {
    id: 'amenities',
    name: 'Amenities & Appliances',
    keywords: ['amenity', 'amenities', 'pool', 'hot tub', 'gym', 'laundry', 'washer', 'dryer', 'dishwasher', 'tv', 'television', 'appliance', 'coffee', 'kitchen'],
    relatedKnowledgeFields: ['applianceGuide'],
    templateCategories: ['amenities'],
  },
  {
    id: 'rules',
    name: 'House Rules',
    keywords: ['rule', 'rules', 'pet', 'pets', 'smoke', 'smoking', 'party', 'parties', 'noise', 'quiet', 'guest', 'visitors'],
    relatedKnowledgeFields: ['houseRules'],
    templateCategories: ['general'],
  },
  {
    id: 'local',
    name: 'Local Recommendations',
    keywords: ['restaurant', 'food', 'eat', 'dining', 'bar', 'beach', 'attraction', 'recommend', 'nearby', 'area', 'activity', 'activities', 'things to do', 'grocery'],
    relatedKnowledgeFields: ['localRecommendations'],
    templateCategories: ['general'],
  },
  {
    id: 'emergency',
    name: 'Emergency & Safety',
    keywords: ['emergency', 'urgent', 'help', 'fire', 'flood', 'police', 'ambulance', 'hospital', 'safety', 'alarm', 'extinguisher'],
    relatedKnowledgeFields: ['emergencyContacts'],
    templateCategories: ['issue'],
  },
  {
    id: 'maintenance',
    name: 'Maintenance Issues',
    keywords: ['broken', 'not working', 'fix', 'repair', 'maintenance', 'problem', 'issue', 'leak', 'clog', 'stuck'],
    relatedKnowledgeFields: [],
    templateCategories: ['issue'],
  },
  {
    id: 'booking',
    name: 'Booking & Reservation',
    keywords: ['booking', 'reservation', 'extend', 'cancel', 'refund', 'modify', 'change', 'dates', 'price', 'cost', 'fee'],
    relatedKnowledgeFields: ['earlyCheckInFee', 'lateCheckOutFee'],
    templateCategories: ['booking'],
  },
  {
    id: 'thanks',
    name: 'Thank You & Feedback',
    keywords: ['thank', 'thanks', 'appreciate', 'great', 'amazing', 'wonderful', 'review', 'feedback', 'enjoyed'],
    relatedKnowledgeFields: [],
    templateCategories: ['thanks'],
  },
];

// Analyzed question with coverage info
export interface AnalyzedQuestion {
  id: string;
  content: string;
  category: QuestionCategory | null;
  categoryId: string;
  occurrences: number;
  hasKnowledgeCoverage: boolean;
  hasTemplateCoverage: boolean;
  matchingTemplates: string[];
  averageResponseTime: number | null;
  sampleConversationIds: string[];
  lastAsked: Date;
  suggestedAction: 'none' | 'add_knowledge' | 'create_template' | 'improve_template';
}

// Coverage report for a property or overall
export interface CoverageReport {
  propertyId: string | null; // null for overall
  totalQuestions: number;
  questionsWithKnowledge: number;
  questionsWithTemplates: number;
  coveragePercentage: number;
  knowledgeCoveragePercentage: number;
  templateCoveragePercentage: number;
  categoryBreakdown: CategoryCoverageStats[];
  topUnansweredQuestions: AnalyzedQuestion[];
  topRepeatedQuestions: AnalyzedQuestion[];
  gaps: CoverageGap[];
  lastAnalyzed: Date;
}

// Category-level stats
export interface CategoryCoverageStats {
  category: QuestionCategory;
  totalQuestions: number;
  withKnowledge: number;
  withTemplates: number;
  coveragePercentage: number;
  trend: 'improving' | 'stable' | 'declining';
}

// Identified gap in coverage
export interface CoverageGap {
  id: string;
  type: 'missing_knowledge' | 'missing_template' | 'low_confidence' | 'slow_response';
  category: string;
  description: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
  suggestedFix: string;
  exampleQuestions: string[];
  canAutoFix: boolean;
}

// Alert for coverage issues
export interface CoverageAlert {
  id: string;
  type: 'new_question_type' | 'coverage_drop' | 'repeated_gap' | 'slow_response';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category?: string;
  questionId?: string;
  timestamp: Date;
  dismissed: boolean;
  actionTaken: boolean;
}

/**
 * Categorize a guest question
 */
export function categorizeQuestion(content: string): QuestionCategory | null {
  const lowerContent = content.toLowerCase();

  for (const category of QUESTION_CATEGORIES) {
    const matchCount = category.keywords.filter(kw => lowerContent.includes(kw)).length;
    if (matchCount >= 1) {
      return category;
    }
  }

  return null;
}

/**
 * Check if a question has knowledge base coverage
 */
export function hasKnowledgeCoverage(
  question: string,
  category: QuestionCategory | null,
  propertyKnowledge?: PropertyKnowledge
): boolean {
  if (!category || !propertyKnowledge) return false;

  // Check if any related knowledge fields are populated
  return category.relatedKnowledgeFields.some(field => {
    const value = propertyKnowledge[field];
    return value !== undefined && value !== null && value !== '';
  });
}

/**
 * Find matching templates for a question
 */
export function findMatchingTemplatesForQuestion(
  question: string,
  category: QuestionCategory | null,
  templates: QuickReplyTemplate[],
  propertyId: string | null
): QuickReplyTemplate[] {
  const lowerQuestion = question.toLowerCase();

  return templates.filter(template => {
    // Check property match (global or same property)
    if (template.propertyId && template.propertyId !== propertyId) {
      return false;
    }

    // Check category match
    if (category && category.templateCategories.includes(template.category)) {
      return true;
    }

    // Check keyword match
    const keywordMatch = template.keywords.some(kw =>
      lowerQuestion.includes(kw.toLowerCase())
    );

    return keywordMatch;
  });
}

/**
 * Extract questions from conversation messages
 */
export function extractQuestionsFromMessages(messages: Message[]): Message[] {
  return messages.filter(m => {
    if (m.sender !== 'guest') return false;
    const content = m.content.toLowerCase();
    // Look for question indicators
    return content.includes('?') ||
           content.includes('how') ||
           content.includes('what') ||
           content.includes('where') ||
           content.includes('when') ||
           content.includes('can i') ||
           content.includes('could you') ||
           content.includes('do you') ||
           content.includes('is there') ||
           content.includes('are there');
  });
}

/**
 * Normalize question for deduplication
 */
function normalizeQuestion(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two questions (simple approach)
 */
function questionSimilarity(q1: string, q2: string): number {
  const words1 = new Set(normalizeQuestion(q1).split(' '));
  const words2 = new Set(normalizeQuestion(q2).split(' '));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Group similar questions together
 */
export function groupSimilarQuestions(
  questions: { content: string; conversationId: string; timestamp: Date; propertyId: string }[]
): Map<string, { content: string; conversationId: string; timestamp: Date; propertyId: string }[]> {
  const groups = new Map<string, { content: string; conversationId: string; timestamp: Date; propertyId: string }[]>();
  const threshold = 0.5; // Similarity threshold for grouping

  for (const question of questions) {
    let foundGroup = false;

    for (const [key, group] of groups) {
      if (questionSimilarity(question.content, key) >= threshold) {
        group.push(question);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.set(question.content, [question]);
    }
  }

  return groups;
}

/**
 * Analyze conversations to generate coverage report
 */
export function analyzeKnowledgeCoverage(
  conversations: Conversation[],
  templates: QuickReplyTemplate[],
  propertyKnowledge: Record<string, PropertyKnowledge>,
  propertyId: string | null = null
): CoverageReport {
  // Filter conversations by property if specified
  const relevantConversations = propertyId
    ? conversations.filter(c => c.property.id === propertyId)
    : conversations;

  // Extract all guest questions
  const allQuestions: { content: string; conversationId: string; timestamp: Date; propertyId: string }[] = [];

  for (const conv of relevantConversations) {
    const questions = extractQuestionsFromMessages(conv.messages);
    for (const q of questions) {
      allQuestions.push({
        content: q.content,
        conversationId: conv.id,
        timestamp: q.timestamp instanceof Date ? q.timestamp : new Date(q.timestamp),
        propertyId: conv.property.id,
      });
    }
  }

  // Group similar questions
  const questionGroups = groupSimilarQuestions(allQuestions);

  // Analyze each question group
  const analyzedQuestions: AnalyzedQuestion[] = [];
  const categoryStats = new Map<string, { total: number; withKnowledge: number; withTemplates: number }>();

  // Initialize category stats
  for (const cat of QUESTION_CATEGORIES) {
    categoryStats.set(cat.id, { total: 0, withKnowledge: 0, withTemplates: 0 });
  }
  categoryStats.set('uncategorized', { total: 0, withKnowledge: 0, withTemplates: 0 });

  let questionsWithKnowledge = 0;
  let questionsWithTemplates = 0;

  for (const [representativeQuestion, occurrences] of questionGroups) {
    const category = categorizeQuestion(representativeQuestion);
    const categoryId = category?.id || 'uncategorized';

    // Get knowledge for the first occurrence's property
    const firstOccurrence = occurrences[0];
    const knowledge = propertyKnowledge[firstOccurrence.propertyId];

    const hasKnowledge = hasKnowledgeCoverage(representativeQuestion, category, knowledge);
    const matchingTemplates = findMatchingTemplatesForQuestion(
      representativeQuestion,
      category,
      templates,
      propertyId
    );
    const hasTemplates = matchingTemplates.length > 0;

    // Update stats
    const stats = categoryStats.get(categoryId) || { total: 0, withKnowledge: 0, withTemplates: 0 };
    stats.total += 1;
    if (hasKnowledge) stats.withKnowledge += 1;
    if (hasTemplates) stats.withTemplates += 1;
    categoryStats.set(categoryId, stats);

    if (hasKnowledge) questionsWithKnowledge++;
    if (hasTemplates) questionsWithTemplates++;

    // Determine suggested action
    let suggestedAction: AnalyzedQuestion['suggestedAction'] = 'none';
    if (!hasKnowledge && category?.relatedKnowledgeFields.length) {
      suggestedAction = 'add_knowledge';
    } else if (!hasTemplates) {
      suggestedAction = 'create_template';
    } else if (matchingTemplates.length === 1 && occurrences.length > 5) {
      suggestedAction = 'improve_template';
    }

    analyzedQuestions.push({
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: representativeQuestion,
      category,
      categoryId,
      occurrences: occurrences.length,
      hasKnowledgeCoverage: hasKnowledge,
      hasTemplateCoverage: hasTemplates,
      matchingTemplates: matchingTemplates.map(t => t.id),
      averageResponseTime: null, // TODO: Calculate from conversation data
      sampleConversationIds: occurrences.slice(0, 5).map(o => o.conversationId),
      lastAsked: occurrences.reduce((latest, o) =>
        o.timestamp > latest ? o.timestamp : latest,
        occurrences[0].timestamp
      ),
      suggestedAction,
    });
  }

  const totalQuestions = analyzedQuestions.length;

  // Build category breakdown
  const categoryBreakdown: CategoryCoverageStats[] = QUESTION_CATEGORIES.map(cat => {
    const stats = categoryStats.get(cat.id) || { total: 0, withKnowledge: 0, withTemplates: 0 };
    const coverage = stats.total > 0
      ? Math.round(((stats.withKnowledge + stats.withTemplates) / (stats.total * 2)) * 100)
      : 100;

    return {
      category: cat,
      totalQuestions: stats.total,
      withKnowledge: stats.withKnowledge,
      withTemplates: stats.withTemplates,
      coveragePercentage: coverage,
      trend: 'stable' as const, // TODO: Calculate from historical data
    };
  }).filter(c => c.totalQuestions > 0);

  // Identify gaps
  const gaps: CoverageGap[] = [];

  for (const question of analyzedQuestions) {
    if (question.occurrences >= 3 && !question.hasKnowledgeCoverage && !question.hasTemplateCoverage) {
      const cat = question.category;

      gaps.push({
        id: `gap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: cat?.relatedKnowledgeFields.length ? 'missing_knowledge' : 'missing_template',
        category: question.categoryId,
        description: `"${question.content.substring(0, 50)}..." asked ${question.occurrences} times with no good answer`,
        frequency: question.occurrences,
        impact: question.occurrences >= 10 ? 'high' : question.occurrences >= 5 ? 'medium' : 'low',
        suggestedFix: cat?.relatedKnowledgeFields.length
          ? `Add ${cat.name} information to property knowledge base`
          : `Create a template for ${cat?.name || 'this question type'}`,
        exampleQuestions: [question.content],
        canAutoFix: true,
      });
    }
  }

  // Get top unanswered and repeated questions
  const topUnanswered = analyzedQuestions
    .filter(q => !q.hasKnowledgeCoverage && !q.hasTemplateCoverage)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  const topRepeated = analyzedQuestions
    .filter(q => q.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  // Calculate overall coverage
  const coveragePercentage = totalQuestions > 0
    ? Math.round(((questionsWithKnowledge + questionsWithTemplates) / (totalQuestions * 2)) * 100)
    : 100;

  return {
    propertyId,
    totalQuestions,
    questionsWithKnowledge,
    questionsWithTemplates,
    coveragePercentage,
    knowledgeCoveragePercentage: totalQuestions > 0
      ? Math.round((questionsWithKnowledge / totalQuestions) * 100)
      : 100,
    templateCoveragePercentage: totalQuestions > 0
      ? Math.round((questionsWithTemplates / totalQuestions) * 100)
      : 100,
    categoryBreakdown,
    topUnansweredQuestions: topUnanswered,
    topRepeatedQuestions: topRepeated,
    gaps,
    lastAnalyzed: new Date(),
  };
}

/**
 * Generate alerts based on coverage analysis
 */
export function generateCoverageAlerts(
  report: CoverageReport,
  previousReport?: CoverageReport
): CoverageAlert[] {
  const alerts: CoverageAlert[] = [];

  // Alert for low overall coverage
  if (report.coveragePercentage < 70) {
    alerts.push({
      id: `alert_${Date.now()}_coverage`,
      type: 'coverage_drop',
      severity: report.coveragePercentage < 50 ? 'high' : 'medium',
      title: 'Low Knowledge Coverage',
      description: `Only ${report.coveragePercentage}% of guest questions have good answers. Consider adding more templates or knowledge.`,
      timestamp: new Date(),
      dismissed: false,
      actionTaken: false,
    });
  }

  // Alert for coverage drop
  if (previousReport && report.coveragePercentage < previousReport.coveragePercentage - 10) {
    alerts.push({
      id: `alert_${Date.now()}_drop`,
      type: 'coverage_drop',
      severity: 'high',
      title: 'Coverage Dropped',
      description: `Coverage dropped from ${previousReport.coveragePercentage}% to ${report.coveragePercentage}%. New question types may be emerging.`,
      timestamp: new Date(),
      dismissed: false,
      actionTaken: false,
    });
  }

  // Alert for high-frequency gaps
  for (const gap of report.gaps.filter(g => g.impact === 'high')) {
    alerts.push({
      id: `alert_${Date.now()}_gap_${gap.id}`,
      type: 'repeated_gap',
      severity: 'high',
      title: `Repeated Unanswered Question: ${gap.category}`,
      description: gap.description,
      category: gap.category,
      timestamp: new Date(),
      dismissed: false,
      actionTaken: false,
    });
  }

  // Alert for new question patterns
  for (const question of report.topUnansweredQuestions.slice(0, 3)) {
    if (question.occurrences >= 5 && !question.hasKnowledgeCoverage && !question.hasTemplateCoverage) {
      alerts.push({
        id: `alert_${Date.now()}_new_${question.id}`,
        type: 'new_question_type',
        severity: 'medium',
        title: `New Question Pattern Detected`,
        description: `"${question.content.substring(0, 60)}..." has been asked ${question.occurrences} times without a good template.`,
        category: question.categoryId,
        questionId: question.id,
        timestamp: new Date(),
        dismissed: false,
        actionTaken: false,
      });
    }
  }

  return alerts;
}

/**
 * Generate suggested template from a gap
 */
export function generateTemplateFromGap(
  gap: CoverageGap,
  category: QuestionCategory | null
): Partial<QuickReplyTemplate> {
  const categoryMap: Record<string, QuickReplyTemplate['category']> = {
    wifi: 'wifi',
    checkin: 'check_in',
    checkout: 'check_out',
    parking: 'parking',
    amenities: 'amenities',
    maintenance: 'issue',
    emergency: 'issue',
    booking: 'booking',
    thanks: 'thanks',
    rules: 'general',
    local: 'general',
    uncategorized: 'general',
  };

  return {
    name: `${category?.name || 'General'} Response`,
    content: '', // User will fill this in
    category: categoryMap[gap.category] || 'general',
    keywords: category?.keywords.slice(0, 5) || [],
    propertyId: null, // Global by default
    priority: gap.impact === 'high' ? 10 : gap.impact === 'medium' ? 5 : 1,
    source: 'manual',
  };
}

/**
 * Get coverage status color
 */
export function getCoverageColor(percentage: number): string {
  if (percentage >= 90) return '#22C55E'; // Green
  if (percentage >= 70) return '#F59E0B'; // Yellow/Amber
  if (percentage >= 50) return '#F97316'; // Orange
  return '#EF4444'; // Red
}

/**
 * Get coverage status label
 */
export function getCoverageLabel(percentage: number): string {
  if (percentage >= 90) return 'Excellent';
  if (percentage >= 70) return 'Good';
  if (percentage >= 50) return 'Needs Improvement';
  return 'Critical';
}

/**
 * Format coverage for display
 */
export function formatCoverageDisplay(report: CoverageReport): {
  headline: string;
  summary: string;
  actionRequired: boolean;
} {
  const percentage = report.coveragePercentage;
  const gapCount = report.gaps.length;
  const highImpactGaps = report.gaps.filter(g => g.impact === 'high').length;

  let headline = `${percentage}% Coverage`;
  let summary = '';
  let actionRequired = false;

  if (percentage >= 90) {
    summary = `${report.questionsWithKnowledge} of ${report.totalQuestions} question types have strong historical answers.`;
  } else if (percentage >= 70) {
    summary = `Good coverage, but ${gapCount} gap${gapCount !== 1 ? 's' : ''} could be improved.`;
    actionRequired = gapCount > 0;
  } else {
    summary = `${highImpactGaps} high-impact gap${highImpactGaps !== 1 ? 's' : ''} need attention. Consider adding templates.`;
    actionRequired = true;
  }

  return { headline, summary, actionRequired };
}
