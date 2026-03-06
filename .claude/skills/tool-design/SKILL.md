---
name: tool-design
description: Guides building effective tools for agent systems. Activate when creating new tools, debugging tool-related failures, optimizing tool sets, designing tool APIs, or evaluating tools for agent integration.
---

# Tool Design for Agents

Tools are the primary mechanism through which agents interact with the world. Unlike traditional APIs designed for developers, tool APIs must be designed for language models that reason about intent and generate calls from natural language. Poor tool design creates failure modes that no amount of prompt engineering can fix.

## When to Activate

Activate this skill when:
- Creating new tools for agent systems
- Debugging tool-related failures or misuse
- Optimizing existing tool sets for better agent performance
- Designing tool APIs from scratch
- Evaluating third-party tools for agent integration

## Core Principles

### The Consolidation Principle
If a human engineer cannot definitively say which tool should be used in a given situation, an agent cannot be expected to do better. Prefer single comprehensive tools over multiple narrow tools. Instead of `list_users`, `list_events`, `create_event`, implement `schedule_event` that handles the full workflow.

### Tool Descriptions Are Prompt Engineering
Descriptions are loaded into agent context and steer behavior. They must answer: what the tool does, when to use it, what inputs it accepts, and what it returns.

### Architectural Reduction
Sometimes removing most specialized tools in favor of primitive, general-purpose capabilities outperforms sophisticated multi-tool architectures. A file system agent using standard Unix utilities can outperform complex custom tooling.

## Description Engineering

Effective descriptions answer four questions:
1. **What** does the tool do? Clear, specific — no vague "helps with" language
2. **When** should it be used? Specific triggers and contexts
3. **What inputs** does it accept? Types, constraints, defaults
4. **What does it return?** Output format, examples, error conditions

## Response Format Optimization

Implement format options (concise vs detailed) to give agents control over verbosity. Include guidance about when to use each format.

## Error Message Design

Error messages must be actionable for agents:
- Retryable errors: include retry guidance
- Input errors: include corrected format
- Missing data: include what's needed

## Tool Collection Design

- 10-20 tools is reasonable for most applications
- Use namespacing for logical groupings
- Tool description overlap causes model confusion
- MCP tools: always use fully qualified names (`ServerName:tool_name`)

## Anti-Patterns

- Vague descriptions ("Search the database for customer information")
- Cryptic parameter names (`x`, `val`, `param1`)
- Missing error handling with generic failures
- Inconsistent naming across tools
- Building tools to "protect" the model from complexity

## Guidelines

1. Write descriptions that answer what, when, and what returns
2. Use consolidation to reduce ambiguity
3. Implement response format options for token efficiency
4. Design error messages for agent recovery
5. Follow consistent naming conventions
6. Limit tool count and use namespacing
7. Question whether each tool enables or constrains the model
8. Prefer primitive, general-purpose tools over specialized wrappers
9. Build minimal architectures that benefit from model improvements
