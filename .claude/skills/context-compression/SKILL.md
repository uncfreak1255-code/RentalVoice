---
name: context-compression
description: This skill should be used when the user asks to "compress context", "summarize conversation history", "implement compaction", "reduce token usage", or mentions context compression, structured summarization, tokens-per-task optimization, or long-running agent sessions exceeding context limits.
---

# Context Compression Strategies

When agent sessions generate millions of tokens of conversation history, compression becomes mandatory. The correct optimization target is tokens per task: total tokens consumed to complete a task, including re-fetching costs when compression loses critical information.

## When to Activate

Activate this skill when:
- Agent sessions exceed context window limits
- Codebases exceed context windows (5M+ token systems)
- Designing conversation summarization strategies
- Debugging cases where agents "forget" what files they modified
- Building evaluation frameworks for compression quality

## Core Approaches

1. **Anchored Iterative Summarization**: Maintain structured, persistent summaries with explicit sections for session intent, file modifications, decisions, and next steps. Structure forces preservation.

2. **Opaque Compression**: Highest compression ratios (99%+) but sacrifices interpretability.

3. **Regenerative Full Summary**: Readable output but may lose details across repeated compression cycles.

## Structured Summary Template

```markdown
## Session Intent
[What the user is trying to accomplish]

## Files Modified
- file.ts: Description of change

## Decisions Made
- Decision and rationale

## Current State
- Status of work

## Next Steps
1. Next action items
```

## Compression Triggers

| Strategy | Trigger Point | Trade-off |
|----------|---------------|-----------|
| Fixed threshold | 70-80% context utilization | Simple but may compress too early |
| Sliding window | Keep last N turns + summary | Predictable context size |
| Importance-based | Compress low-relevance first | Complex but preserves signal |
| Task-boundary | Compress at task completions | Clean summaries |

## Compression Ratios

| Method | Ratio | Quality Score |
|--------|-------|---------------|
| Anchored Iterative | 98.6% | 3.70 |
| Regenerative | 98.7% | 3.44 |
| Opaque | 99.3% | 3.35 |

## Guidelines

1. Optimize for tokens-per-task, not tokens-per-request
2. Use structured summaries with explicit sections for file tracking
3. Trigger compression at 70-80% context utilization
4. Implement incremental merging rather than full regeneration
5. Track artifact trail separately if file tracking is critical
6. Monitor re-fetching frequency as a compression quality signal
