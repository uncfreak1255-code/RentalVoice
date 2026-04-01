import type {
  EnhancedAIResponse,
  ActionItem,
  KnowledgeConflict,
  RegenerationOption,
  HistoricalMatchInfo,
} from '@/lib/ai-enhanced';

export interface ChatScreenProps {
  conversationId: string;
  onBack: () => void;
  onOpenUpsells?: () => void;
}

/** Enhanced AI draft with all new features */
export interface EnhancedAiDraft {
  content: string;
  confidence: number;
  sentiment?: EnhancedAIResponse['sentiment'];
  confidenceDetails?: EnhancedAIResponse['confidence'];
  actionItems?: ActionItem[];
  regenerationOptions?: RegenerationOption[];
  topics?: EnhancedAIResponse['topics'];
  historicalMatches?: HistoricalMatchInfo;
  knowledgeConflicts?: KnowledgeConflict[];
  isEdited?: boolean;
  originalContent?: string;
}

export type LearningToastType = 'approval' | 'edit' | 'independent' | 'rejection';
