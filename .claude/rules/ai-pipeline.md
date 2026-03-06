---
globs: src/lib/ai-*.ts, src/lib/advanced-training.ts, src/hooks/useAIDraft.ts
---

# AI Pipeline Rules

## Architecture Flow
```
hostaway.ts → history-sync.ts → ai-training-service.ts → ai-learning.ts → ai-enhanced.ts
```

## Training Pipeline
- `ai-training-service.ts`: 3-phase training (sampling, style analysis, response index)
- Smart sampling: up to 8K messages, stratified by property/intent/length
- Style analysis: formality, warmth, phrases, greetings in batches
- Response index: guest→host pairs indexed by intent + keyword

## Draft Generation
- `ai-enhanced.ts`: Entry point for draft generation
- Style instructions from `ai-learning.ts` → `generateStyleInstructions()`
- Historical recall with intent + keyword matching
- Edited drafts get priority: `ResponsePattern.priority = 'high'`, +15 score bonus

## Key Constraints
- Respect token budgets — compress context before exceeding limits
- Edited drafts are training signal — always weight them higher than raw history
- Multi-language support via `src/lib/language-detect.ts` and `src/lib/cultural-tone.ts`
- Sentiment analysis in `src/lib/sentiment-analysis.ts` feeds urgency scoring
- Content filtering required on all AI outputs (App Store compliance)

## Testing
- `src/hooks/__tests__/useAIDraft.test.ts`
- `src/lib/__tests__/ai-intelligence.test.ts`
- `src/lib/__tests__/edit-diff-analysis.test.ts`
