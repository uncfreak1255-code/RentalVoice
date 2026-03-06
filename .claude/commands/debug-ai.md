---
description: Debug AI draft generation pipeline issues
model: sonnet
---

Debug an issue with the AI draft generation pipeline. Follow this diagnostic flow:

1. Ask the user to describe the symptom (wrong tone, missing context, slow, errors, etc.)

2. Trace the pipeline in order:
   - `src/lib/ai-enhanced.ts` — Draft generation entry point
   - `src/lib/ai-learning.ts` — Style profile and `generateStyleInstructions()`
   - `src/lib/ai-training-service.ts` — Training data (sampling, style analysis, response index)
   - `src/lib/ai-intelligence.ts` — Intelligence layer
   - `src/lib/ai-service.ts` — LLM API calls
   - `src/hooks/useAIDraft.ts` — React hook that ties it together

3. Check the relevant files for the symptom:
   - Wrong tone → Check style profile in `ai-learning.ts`, verify `generateStyleInstructions()` output
   - Missing context → Check property knowledge, conversation history truncation in `ai-enhanced.ts`
   - Slow → Check token counts, batch sizes in `ai-training-service.ts`
   - Errors → Check API key config in `ai-keys.ts`, model picker in `src/lib/config.ts`

4. Read the test files for relevant assertions:
   - `src/hooks/__tests__/useAIDraft.test.ts`
   - `src/lib/__tests__/ai-intelligence.test.ts`

5. Propose a fix with minimal changes. Run `npm run typecheck` after any edits.
