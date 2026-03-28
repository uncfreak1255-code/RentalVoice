import { beforeEach, describe, expect, it, vi } from 'vitest';

let styleProfileResults: Array<{ data: unknown; error: unknown }> = [];
let editPatternResults: Array<{ data: unknown; error: unknown }> = [];

function makeChain(table: string) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => {
    if (table === 'host_style_profiles') {
      return Promise.resolve(styleProfileResults.shift() ?? { data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  chain.then = (onFulfilled: (value: unknown) => unknown) => {
    if (table === 'edit_patterns') {
      return Promise.resolve(editPatternResults.shift() ?? { data: [], error: null }).then(onFulfilled);
    }
    return Promise.resolve({ data: [], error: null }).then(onFulfilled);
  };
  return chain;
}

const mockRpc = vi.fn();
const mockSupabaseAdmin = {
  from: vi.fn((table: string) => makeChain(table)),
  rpc: mockRpc,
};
const mockEmbedText = vi.fn();

vi.mock('../db/supabase.js', () => ({
  getSupabaseAdmin: () => mockSupabaseAdmin,
}));

vi.mock('../services/embedding.js', () => ({
  embedText: mockEmbedText,
}));

const { buildManagedVoicePrompt } = await import('../services/voice-grounding.js');

describe('buildManagedVoicePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    styleProfileResults = [
      {
        data: {
          profile_json: {
            trained: true,
            tonePreference: 'detailed',
            topPhrases: ['Absolutely happy to help', 'Let me know if anything comes up'],
            usesExclamation: true,
          },
        },
        error: null,
      },
    ];
    editPatternResults = [
      {
        data: [
          {
            original: 'Check-in is at 4.',
            edited: 'You are all set for check-in at 4pm today!',
            category: 'arrival',
          },
        ],
        error: null,
      },
    ];
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    mockRpc.mockResolvedValue({
      data: [
        {
          guest_message: 'Can we check in early?',
          host_response: 'Absolutely happy to help. If the cleaners finish early, I can message you right away.',
          origin_type: 'host_written',
          property_id: 'prop-1',
          similarity: 0.98,
        },
      ],
      error: null,
    });
  });

  it('builds managed prompts from style profile plus semantic voice examples', async () => {
    const prompt = await buildManagedVoicePrompt({
      orgId: 'org-1',
      propertyId: 'prop-1',
      guestMessage: 'Can we check in early?',
      guestName: 'Jamie',
    });

    expect(prompt).toContain('REAL HOST REPLY EXAMPLES');
    expect(prompt).toContain('property prop-1');
    expect(prompt).toContain('Absolutely happy to help');
    expect(prompt).toContain('RECENT HOST EDIT SIGNALS');
    expect(mockRpc).toHaveBeenCalledWith('match_voice_examples', expect.objectContaining({
      query_org_id: 'org-1',
      query_property_id: 'prop-1',
      match_count: 5,
    }));
  });
});
