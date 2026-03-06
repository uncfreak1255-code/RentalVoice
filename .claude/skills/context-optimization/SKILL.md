---
name: context-optimization
description: This skill should be used when the user asks to "optimize context", "reduce token costs", "improve context efficiency", "implement KV-cache optimization", "partition context", or mentions context limits, observation masking, context budgeting, or extending effective context capacity.
---

# Context Optimization Techniques

Context optimization extends the effective capacity of limited context windows through strategic compression, masking, caching, and partitioning. The goal is not to magically increase context windows but to make better use of available capacity. Effective optimization can double or triple effective context capacity without requiring larger models or longer contexts.

## When to Activate

Activate this skill when:
- Context limits constrain task complexity
- Optimizing for cost reduction (fewer tokens = lower costs)
- Reducing latency for long conversations
- Implementing long-running agent systems
- Needing to handle larger documents or conversations
- Building production systems at scale

## Core Concepts

Context optimization extends effective capacity through four primary strategies: compaction (summarizing context near limits), observation masking (replacing verbose outputs with references), KV-cache optimization (reusing cached computations), and context partitioning (splitting work across isolated contexts).

The key insight is that context quality matters more than quantity. Optimization preserves signal while reducing noise.

## Detailed Topics

### Compaction Strategies

Compaction is the practice of summarizing context contents when approaching limits, then reinitializing a new context window with the summary. Priority for compression: tool outputs first, then old turns, then retrieved docs. Never compress system prompt.

### Observation Masking

Tool outputs can comprise 80%+ of token usage in agent trajectories. Observation masking replaces verbose tool outputs with compact references. Never mask observations critical to current task or from the most recent turn.

### KV-Cache Optimization

Place stable elements first (system prompt, tool definitions), then frequently reused elements, then unique elements last. Avoid dynamic content like timestamps in cacheable prefixes.

### Context Partitioning

Partition work across sub-agents with isolated contexts. Each sub-agent operates in a clean context focused on its subtask without carrying accumulated context from other subtasks.

## Performance Targets

- Compaction: 50-70% token reduction with <5% quality degradation
- Masking: 60-80% reduction in masked observations
- Cache optimization: 70%+ hit rate for stable workloads

## Guidelines

1. Measure before optimizing — know your current state
2. Apply compaction before masking when possible
3. Design for cache stability with consistent prompts
4. Partition before context becomes problematic
5. Monitor optimization effectiveness over time
6. Balance token savings against quality preservation
