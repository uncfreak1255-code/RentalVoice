---
name: memory-systems
description: Guides implementation of agent memory systems. Use when the user asks to "implement agent memory", "persist state across sessions", "build knowledge graph", "track entities over time", "add long-term memory", or "choose a memory framework".
---

# Memory System Design

Memory provides the persistence layer that allows agents to maintain continuity across sessions. Simple agents rely entirely on context for memory, losing all state when sessions end. Sophisticated agents implement layered memory architectures that balance immediate context needs with long-term knowledge retention.

## When to Activate

Activate this skill when:
- Building agents that must persist knowledge across sessions
- Choosing between memory frameworks (Mem0, Zep/Graphiti, Letta, LangMem)
- Maintaining entity consistency across conversations
- Designing memory architectures that scale in production

## Framework Comparison

| Framework | Architecture | Best For |
|-----------|-------------|----------|
| **Mem0** | Vector store + graph, pluggable backends | Multi-tenant, fast to production |
| **Zep/Graphiti** | Temporal knowledge graph, bi-temporal model | Relationship modeling + temporal reasoning |
| **Letta** | Self-editing memory, tiered storage | Full agent introspection |
| **LangMem** | Memory tools for LangGraph | Teams already on LangGraph |
| **File-system** | Plain files with naming conventions | Simple agents, prototyping |

Key insight: **tool complexity matters less than reliable retrieval** — Letta's filesystem agents scored 74% on LoCoMo using basic file operations, beating Mem0's specialized tools at 68.5%.

## Memory Layers

| Layer | Persistence | When to Use |
|-------|------------|-------------|
| **Working** | Context window only | Always — scratchpad in system prompt |
| **Short-term** | Session-scoped | Intermediate tool results, conversation state |
| **Long-term** | Cross-session | User preferences, domain knowledge, entity registries |
| **Entity** | Cross-session | Maintaining identity across conversations |
| **Temporal KG** | Cross-session + history | Facts that change over time |

## Retrieval Strategies

| Strategy | Use When |
|----------|----------|
| **Semantic** (embedding similarity) | Direct factual queries |
| **Entity-based** (graph traversal) | "Tell me everything about X" |
| **Temporal** (validity filter) | Facts change over time |
| **Hybrid** (all combined) | Best overall accuracy |

## Choosing an Architecture

**Start simple, add complexity only when retrieval fails.**

1. **Prototype**: File-system memory with structured JSON + timestamps
2. **Scale**: Mem0 or vector store when you need semantic search
3. **Complex reasoning**: Zep/Graphiti for relationships and temporal validity
4. **Full control**: Letta for agent self-management of memory

## Guidelines

1. Start with file-system memory; add complexity when retrieval demands it
2. Track temporal validity for any fact that can change
3. Use hybrid retrieval for best accuracy
4. Consolidate memories periodically — invalidate but don't discard
5. Design for retrieval failure: always have a fallback
6. Consider privacy implications (retention policies, deletion rights)
7. Monitor memory growth and retrieval latency in production
