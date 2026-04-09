import { createCalibrationEntry, analyzeReplyDelta } from './ai-intelligence';
import { incrementalTrainer, fewShotIndexer } from './advanced-training';
import {
  recordDraftOutcomeViaServer,
  submitEditFeedback,
  type DraftOutcomeFeedbackRequest,
  type EditFeedbackRequest,
} from './api-client';
import {
  analyzeEdit,
  analyzeIndependentReply,
  getEditSummary,
  getIndependentReplySummary,
  storeEditPattern,
  storeIndependentReplyPattern,
  type IndependentReplyPattern,
} from './edit-diff-analysis';
import * as semanticVoiceIndex from './semantic-voice-index';
import type {
  AILearningProgress,
  DraftOutcome,
  DraftOutcomeType,
  LearningEntry,
  MessageOriginType,
} from './store';
import { useAppStore } from './store';

type FounderSessionLike = {
  accessToken?: string;
  orgId?: string;
} | null;

export type LearningEvent =
  | {
      type: 'host_written';
      source: 'chat_manual' | 'test_my_voice';
      guestMessage: string;
      finalReply: string;
      aiDraft?: string;
      propertyId?: string;
      guestIntent?: string;
      confidence?: number;
    }
  | {
      type: 'ai_approved';
      source: 'chat_approve' | 'test_my_voice';
      guestMessage: string;
      finalReply: string;
      aiDraft: string;
      propertyId?: string;
      guestIntent?: string;
      confidence?: number;
    }
  | {
      type: 'ai_edited';
      source: 'chat_edit' | 'test_my_voice';
      guestMessage: string;
      finalReply: string;
      aiDraft: string;
      propertyId?: string;
      guestIntent?: string;
      confidence?: number;
    };

export type LearningCorrectionKind = 'none' | 'edit_pattern' | 'independent_pattern';

export interface LearningReceipt {
  storedLocalExample: boolean;
  storedLocalCorrection: boolean;
  correctionKind: LearningCorrectionKind;
  queuedIncrementalTraining: boolean;
  syncedServerExample: boolean;
  syncedServerCorrection: boolean;
  updatedOutcomeMetrics: boolean;
  summary: string;
  correctionSummary?: string;
}

export interface LearningQueueMessage {
  id: string;
  content: string;
  guestMessage?: string;
  propertyId?: string;
  timestamp: number;
  wasEdited: boolean;
  wasApproved: boolean;
  originType?: MessageOriginType;
}

export interface LearningEventStoreState {
  founderSession: FounderSessionLike;
  aiLearningProgress?: Partial<AILearningProgress>;
  addLearningEntry: (entry: LearningEntry) => void;
  updateAILearningProgress: (updates: Partial<AILearningProgress>) => void;
  addDraftOutcome: (outcome: DraftOutcome) => void;
  addCalibrationEntry: (entry: unknown) => void;
  addReplyDelta: (delta: unknown) => void;
}

type EditPatternLike = ReturnType<typeof analyzeEdit>;
type IndependentReplyPatternLike = IndependentReplyPattern;
type CalibrationEntryLike = unknown;
type ReplyDeltaLike = unknown;

export interface LearningEventDeps {
  now: () => number;
  randomId: () => string;
  getStoreState: () => LearningEventStoreState;
  queueTrainingMessage: (message: LearningQueueMessage) => Promise<void>;
  addFewShotExample: (
    guestMessage: string,
    hostResponse: string,
    propertyId?: string,
    originType?: MessageOriginType,
  ) => Promise<void>;
  syncSemanticExample: (
    guestMessage: string,
    hostResponse: string,
    propertyId: string,
    originType?: string,
    intent?: string,
  ) => Promise<void>;
  analyzeEdit: typeof analyzeEdit;
  storeEditPattern: (pattern: EditPatternLike) => Promise<void>;
  getEditSummary: (pattern: EditPatternLike) => string;
  analyzeIndependentReply: (
    aiDraft: string,
    hostReply: string,
    guestMessage: string,
    propertyId?: string,
    guestIntent?: string,
  ) => IndependentReplyPatternLike;
  storeIndependentReplyPattern: (pattern: IndependentReplyPatternLike) => Promise<void>;
  getIndependentReplySummary: (pattern: IndependentReplyPatternLike) => string;
  createCalibrationEntry: (outcome: DraftOutcome) => CalibrationEntryLike;
  analyzeReplyDelta: (
    aiDraft: string,
    hostReply: string,
    guestMessage: string,
    propertyId?: string,
    guestIntent?: string,
  ) => ReplyDeltaLike;
  recordServerOutcome: (req: DraftOutcomeFeedbackRequest) => Promise<unknown>;
  submitServerEditFeedback: (req: EditFeedbackRequest) => Promise<unknown>;
}

function defaultDeps(): LearningEventDeps {
  return {
    now: () => Date.now(),
    randomId: () => Math.random().toString(36).slice(2, 11),
    getStoreState: () => useAppStore.getState() as LearningEventStoreState,
    queueTrainingMessage: async (message) => incrementalTrainer.queueMessage(message),
    addFewShotExample: async (guestMessage, hostResponse, propertyId, originType) =>
      fewShotIndexer.addExample(guestMessage, hostResponse, propertyId, originType),
    syncSemanticExample: async (guestMessage, hostResponse, propertyId, originType, intent) =>
      semanticVoiceIndex.learn(guestMessage, hostResponse, propertyId, originType, intent),
    analyzeEdit,
    storeEditPattern,
    getEditSummary,
    analyzeIndependentReply,
    storeIndependentReplyPattern,
    getIndependentReplySummary,
    createCalibrationEntry,
    analyzeReplyDelta,
    recordServerOutcome: async (req) => recordDraftOutcomeViaServer(req),
    submitServerEditFeedback: async (req) => submitEditFeedback(req),
  };
}

function getOriginType(event: LearningEvent): MessageOriginType {
  return event.type;
}

function getOutcomeType(event: LearningEvent): DraftOutcomeType {
  switch (event.type) {
    case 'ai_approved':
      return 'approved';
    case 'ai_edited':
      return 'edited';
    case 'host_written':
      return 'independent';
  }
}

export function eventHasCorrectionTruth(event: LearningEvent): boolean {
  return event.type === 'ai_edited' || (event.type === 'host_written' && Boolean(event.aiDraft));
}

function getLearningEntry(event: LearningEvent, deps: LearningEventDeps): LearningEntry {
  const timestamp = new Date(deps.now());
  return {
    id: `learn-${deps.now()}-${deps.randomId()}`,
    originalResponse: event.type === 'host_written' ? event.finalReply : event.aiDraft,
    editedResponse: event.type === 'ai_edited' ? event.finalReply : undefined,
    wasApproved: event.type !== 'host_written',
    wasEdited: event.type === 'ai_edited',
    guestIntent: event.guestIntent || event.guestMessage.slice(0, 100),
    propertyId: event.propertyId || '',
    timestamp,
    originType: getOriginType(event),
  };
}

function getQueueMessage(event: LearningEvent, deps: LearningEventDeps): LearningQueueMessage {
  return {
    id: `msg_${deps.now()}_${deps.randomId()}`,
    content: event.finalReply,
    guestMessage: event.guestMessage,
    propertyId: event.propertyId,
    timestamp: deps.now(),
    wasEdited: event.type === 'ai_edited',
    wasApproved: event.type !== 'host_written',
    originType: getOriginType(event),
  };
}

function getProgressUpdates(
  event: LearningEvent,
  current: Partial<AILearningProgress> | undefined,
): Partial<AILearningProgress> {
  const base = current || {};
  const patternsIndexed = (base.patternsIndexed || 0) + 1;

  if (event.type === 'ai_edited') {
    return {
      realTimeEditsCount: (base.realTimeEditsCount || 0) + 1,
      patternsIndexed,
    };
  }

  if (event.type === 'ai_approved') {
    return {
      realTimeApprovalsCount: (base.realTimeApprovalsCount || 0) + 1,
      patternsIndexed,
    };
  }

  return {
    realTimeIndependentRepliesCount: (base.realTimeIndependentRepliesCount || 0) + 1,
    patternsIndexed,
  };
}

function buildDraftOutcome(event: LearningEvent, deps: LearningEventDeps): DraftOutcome {
  return {
    id: `outcome_${deps.now()}_${deps.randomId()}`,
    timestamp: new Date(deps.now()),
    outcomeType: getOutcomeType(event),
    propertyId: event.propertyId,
    guestIntent: event.guestIntent,
    confidence: event.confidence,
  };
}

function buildOutcomeRequest(event: LearningEvent): DraftOutcomeFeedbackRequest {
  const request: DraftOutcomeFeedbackRequest = {
    outcomeType: getOutcomeType(event),
    propertyId: event.propertyId,
    guestIntent: event.guestIntent,
    confidence: event.confidence,
    guestMessage: event.guestMessage,
  };

  if (event.type !== 'ai_approved' && event.aiDraft) {
    request.aiDraft = event.aiDraft;
    request.hostReply = event.finalReply;
  }

  return request;
}

function buildReceiptSummary(event: LearningEvent, correctionSummary?: string): string {
  if (event.type === 'ai_edited') {
    return correctionSummary
      ? `Saved correction pattern: ${correctionSummary}`
      : 'Saved example and correction pattern';
  }

  if (event.type === 'ai_approved') {
    return 'Saved approved reply as a strong example';
  }

  if (event.aiDraft) {
    return correctionSummary
      ? `Saved manual rewrite pattern: ${correctionSummary}`
      : 'Saved manual rewrite pattern';
  }

  return 'Saved as a new host-written example';
}

async function attempt(step: () => Promise<unknown>): Promise<boolean> {
  try {
    await step();
    return true;
  } catch (error) {
    console.warn('[LearningEvents] Non-fatal step failed:', error);
    return false;
  }
}

export function createLearningEventRecorder(overrides: Partial<LearningEventDeps> = {}) {
  const deps: LearningEventDeps = {
    ...defaultDeps(),
    ...overrides,
  };

  return async function recordLearningEvent(event: LearningEvent): Promise<LearningReceipt> {
    const state = deps.getStoreState();
    const originType = getOriginType(event);
    const receipt: LearningReceipt = {
      storedLocalExample: false,
      storedLocalCorrection: false,
      correctionKind: 'none',
      queuedIncrementalTraining: false,
      syncedServerExample: false,
      syncedServerCorrection: false,
      updatedOutcomeMetrics: false,
      summary: '',
    };

    state.addLearningEntry(getLearningEntry(event, deps));

    receipt.queuedIncrementalTraining = await attempt(() =>
      deps.queueTrainingMessage(getQueueMessage(event, deps)),
    );

    receipt.storedLocalExample = await attempt(() =>
      deps.addFewShotExample(event.guestMessage, event.finalReply, event.propertyId, originType),
    );

    let correctionSummary: string | undefined;

    if (event.type === 'ai_edited') {
      const editPattern = deps.analyzeEdit(
        event.aiDraft,
        event.finalReply,
        event.propertyId,
        event.guestIntent,
      );
      receipt.storedLocalCorrection = await attempt(() => deps.storeEditPattern(editPattern));
      if (receipt.storedLocalCorrection) {
        receipt.correctionKind = 'edit_pattern';
        correctionSummary = deps.getEditSummary(editPattern);
      }
    } else if (event.type === 'host_written' && event.aiDraft) {
      const independentPattern = deps.analyzeIndependentReply(
        event.aiDraft,
        event.finalReply,
        event.guestMessage,
        event.propertyId,
        event.guestIntent,
      );
      receipt.storedLocalCorrection = await attempt(() =>
        deps.storeIndependentReplyPattern(independentPattern),
      );
      if (receipt.storedLocalCorrection) {
        receipt.correctionKind = 'independent_pattern';
        correctionSummary = deps.getIndependentReplySummary(independentPattern);
      }
    }

    const outcome = buildDraftOutcome(event, deps);
    state.addDraftOutcome(outcome);
    receipt.updatedOutcomeMetrics = true;

    if (event.confidence !== undefined) {
      state.addCalibrationEntry(deps.createCalibrationEntry(outcome));
    }

    if ((event.type === 'ai_edited' || event.type === 'host_written') && event.aiDraft) {
      const aiDraft = event.aiDraft;
      state.addReplyDelta(
        deps.analyzeReplyDelta(
          aiDraft,
          event.finalReply,
          event.guestMessage,
          event.propertyId,
          event.guestIntent,
        ),
      );
    }

    state.updateAILearningProgress(getProgressUpdates(event, state.aiLearningProgress));

    if (state.founderSession?.accessToken && state.founderSession?.orgId && event.propertyId) {
      receipt.syncedServerExample = await attempt(() =>
        deps.syncSemanticExample(
          event.guestMessage,
          event.finalReply,
          event.propertyId || '',
          originType,
          event.guestIntent,
        ),
      );

      const correctionSyncResults: boolean[] = [];

      correctionSyncResults.push(
        await attempt(() => deps.recordServerOutcome(buildOutcomeRequest(event))),
      );

      if (event.type === 'ai_edited') {
        correctionSyncResults.push(
          await attempt(() =>
            deps.submitServerEditFeedback({
              original: event.aiDraft,
              edited: event.finalReply,
              category: event.guestIntent,
              propertyId: event.propertyId,
            }),
          ),
        );
      }

      receipt.syncedServerCorrection =
        correctionSyncResults.length > 0 && correctionSyncResults.every(Boolean);
    }

    receipt.correctionSummary = correctionSummary;
    receipt.summary = buildReceiptSummary(event, correctionSummary);
    return receipt;
  };
}

export const recordLearningEvent = async (event: LearningEvent): Promise<LearningReceipt> =>
  createLearningEventRecorder()(event);

export { buildReceiptSummary as getLearningReceiptSummary };
