import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the langfuse module before any imports
vi.mock('langfuse', () => {
  const mockGeneration = vi.fn();
  const mockSpan = vi.fn();
  const mockUpdate = vi.fn();
  const mockTrace = vi.fn(() => ({
    generation: mockGeneration,
    span: mockSpan,
    update: mockUpdate,
  }));
  const mockShutdownAsync = vi.fn().mockResolvedValue(undefined);

  class MockLangfuse {
    trace = mockTrace;
    shutdownAsync = mockShutdownAsync;
  }

  const MockLangfuseSpy = vi.fn().mockImplementation(function () {
    return new MockLangfuse();
  });

  return {
    Langfuse: MockLangfuseSpy,
    _mocks: { mockTrace, mockGeneration, mockSpan, mockUpdate, mockShutdownAsync, MockLangfuse: MockLangfuseSpy },
  };
});

describe('langfuse tracing service', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear env vars
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_BASEURL;
  });

  it('returns no-op trace when LANGFUSE_PUBLIC_KEY is not set', async () => {
    const { startGenerationTrace, isTracingEnabled } = await import('../services/langfuse.js');

    expect(isTracingEnabled()).toBe(false);

    const trace = startGenerationTrace({
      orgId: 'org-1',
      userId: 'user-1',
      propertyId: 'prop-1',
    });

    // Should not throw
    trace.traceVoiceRetrieval({
      propertyId: 'prop-1',
      styleProfile: null,
      semanticExamples: [],
      recentEditPatterns: [],
    });

    trace.traceGeneration({
      provider: 'google',
      model: 'gemini-2.0-flash',
      systemPrompt: 'test',
      userMessage: 'hello',
      completion: 'hi there',
      durationMs: 100,
      tokensUsed: { input: 10, output: 5 },
      confidence: 75,
      usedFallback: false,
    });

    trace.finalize({ success: true });
  });

  it('creates a real trace when Langfuse keys are configured', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test';

    const { startGenerationTrace, isTracingEnabled } = await import('../services/langfuse.js');
    const { _mocks } = await import('langfuse') as unknown as {
      _mocks: {
        mockTrace: ReturnType<typeof vi.fn>;
        mockGeneration: ReturnType<typeof vi.fn>;
        mockSpan: ReturnType<typeof vi.fn>;
        mockUpdate: ReturnType<typeof vi.fn>;
        MockLangfuse: ReturnType<typeof vi.fn>;
      };
    };

    expect(isTracingEnabled()).toBe(true);
    expect(_mocks.MockLangfuse).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: 'pk-lf-test',
        secretKey: 'sk-lf-test',
        baseUrl: 'https://cloud.langfuse.com',
      }),
    );

    const trace = startGenerationTrace({
      orgId: 'org-1',
      userId: 'user-1',
      propertyId: 'prop-1',
    });

    expect(_mocks.mockTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ai-draft-generation',
        metadata: expect.objectContaining({ orgId: 'org-1' }),
      }),
    );

    // Trace voice retrieval
    trace.traceVoiceRetrieval({
      propertyId: 'prop-1',
      styleProfile: { trained: true, tonePreference: 'detailed' },
      semanticExamples: [
        {
          guest_message: 'Can we check in early?',
          host_response: 'Sure, I will check.',
          origin_type: 'host_written',
          property_id: 'prop-1',
          similarity: 0.95,
        },
      ],
      recentEditPatterns: [],
    });

    expect(_mocks.mockSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'voice-example-retrieval',
        metadata: expect.objectContaining({
          exampleCount: 1,
          hasStyleProfile: true,
          styleProfileTrained: true,
        }),
      }),
    );

    // Trace generation
    trace.traceGeneration({
      provider: 'google',
      model: 'gemini-2.0-flash',
      systemPrompt: 'You are writing...',
      userMessage: 'Can we check in early?',
      completion: 'Sure, I will check on that for you!',
      durationMs: 450,
      tokensUsed: { input: 200, output: 30 },
      confidence: 72,
      usedFallback: false,
    });

    expect(_mocks.mockGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'llm-call',
        model: 'google/gemini-2.0-flash',
        usage: { input: 200, output: 30 },
        metadata: expect.objectContaining({
          durationMs: 450,
          confidence: 72,
          usedFallback: false,
        }),
      }),
    );

    // Finalize
    trace.finalize({ success: true });

    expect(_mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ success: true }),
      }),
    );
  });

  it('shutdownLangfuse flushes when enabled', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test';

    const { shutdownLangfuse, isTracingEnabled } = await import('../services/langfuse.js');
    const { _mocks } = await import('langfuse') as unknown as {
      _mocks: { mockShutdownAsync: ReturnType<typeof vi.fn> };
    };

    // Force initialization
    expect(isTracingEnabled()).toBe(true);

    await shutdownLangfuse();
    expect(_mocks.mockShutdownAsync).toHaveBeenCalled();
  });
});
