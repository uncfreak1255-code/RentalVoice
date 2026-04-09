import type { IndexedResponsePatternLike } from './ai-learning';

export type ActiveRetrievalMode = 'local_few_shot';

export interface RetrievalCoverageSource {
  mode: ActiveRetrievalMode;
  indexedPatterns: IndexedResponsePatternLike[];
  patternCount: number;
  byIntent: Record<string, number>;
}

export interface DraftLearningProof {
  mode: ActiveRetrievalMode;
  similarExamplesCount: number;
  recentCorrectionsCount: number;
  summary: string | null;
}

type FewShotStats = {
  total: number;
  byIntent: Record<string, number>;
};

type FewShotExampleLike = {
  id: string;
};

type StoredEditPatternLike = {
  propertyId?: string;
  timestamp: number;
};

export interface RetrievalSourceDeps {
  now: () => number;
  getFewShotStats: () => FewShotStats;
  findRelevantExamples: (
    guestMessage: string,
    propertyId?: string,
    limit?: number,
  ) => FewShotExampleLike[];
  getStoredEditPatterns: () => Promise<StoredEditPatternLike[]>;
}

function defaultDeps(): RetrievalSourceDeps {
  return {
    now: () => Date.now(),
    getFewShotStats: () => {
      const { fewShotIndexer } = require('./advanced-training');
      return fewShotIndexer.getStats();
    },
    findRelevantExamples: (guestMessage, propertyId, limit) => {
      const { fewShotIndexer } = require('./advanced-training');
      return fewShotIndexer.findRelevantExamples(guestMessage, propertyId, limit);
    },
    getStoredEditPatterns: async () => {
      const { getStoredPatterns } = require('./edit-diff-analysis');
      return getStoredPatterns();
    },
  };
}

function expandIntentCounts(byIntent: Record<string, number>): IndexedResponsePatternLike[] {
  return Object.entries(byIntent).flatMap(([guestIntent, count]) =>
    Array.from({ length: count }, () => ({ guestIntent })),
  );
}

function formatProofSummary(similarExamplesCount: number, recentCorrectionsCount: number): string | null {
  const parts: string[] = [];

  if (similarExamplesCount > 0) {
    parts.push(
      `Using ${similarExamplesCount} similar example${similarExamplesCount === 1 ? '' : 's'}`,
    );
  }

  if (recentCorrectionsCount > 0) {
    parts.push(
      `${parts.length > 0 ? 'and ' : 'Using '}${recentCorrectionsCount} recent correction${recentCorrectionsCount === 1 ? '' : 's'}`,
    );
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

export function createRetrievalSourceReader(overrides: Partial<RetrievalSourceDeps> = {}) {
  const deps: RetrievalSourceDeps = {
    ...defaultDeps(),
    ...overrides,
  };

  return {
    getCoverageSource(): RetrievalCoverageSource {
      const stats = deps.getFewShotStats();
      return {
        mode: 'local_few_shot',
        indexedPatterns: expandIntentCounts(stats.byIntent),
        patternCount: stats.total,
        byIntent: stats.byIntent,
      };
    },

    async getDraftLearningProof(
      guestMessage: string,
      propertyId?: string,
      limit: number = 3,
    ): Promise<DraftLearningProof> {
      const similarExamples = deps.findRelevantExamples(guestMessage, propertyId, limit);
      const now = deps.now();
      const recentWindowMs = 30 * 24 * 60 * 60 * 1000;
      const editPatterns = await deps.getStoredEditPatterns();
      const recentCorrectionsCount = editPatterns.filter((pattern) => {
        const isRecent = now - pattern.timestamp <= recentWindowMs;
        const propertyMatches = propertyId ? pattern.propertyId === propertyId : true;
        return isRecent && propertyMatches;
      }).length;

      return {
        mode: 'local_few_shot',
        similarExamplesCount: similarExamples.length,
        recentCorrectionsCount,
        summary: formatProofSummary(similarExamples.length, recentCorrectionsCount),
      };
    },
  };
}

export function getActiveRetrievalCoverageSource(): RetrievalCoverageSource {
  return createRetrievalSourceReader().getCoverageSource();
}

export async function getDraftLearningProof(
  guestMessage: string,
  propertyId?: string,
  limit?: number,
): Promise<DraftLearningProof> {
  return createRetrievalSourceReader().getDraftLearningProof(guestMessage, propertyId, limit);
}
