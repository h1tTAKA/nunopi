# Nunopi

An AI-powered code learning tool for vibe coders who want code explained at their level.

Nunopi helps beginners understand unfamiliar code by turning AI agent analysis into line-by-line explanations, token dictionaries, and concept notes.  
The goal is not just to "translate" code, but to help users learn how to read code.

## Why

Vibe coding can produce working code quickly, but it often leaves users with code they do not fully understand.

Nunopi is built for moments like these:

- You want to understand what each line of code does.
- You want quick explanations for tokens like `useState`, `props`, `async`, or `className`.
- You want AI-generated code explained in beginner-friendly language.
- You want to know where to start when reading an unfamiliar codebase.

## Product Direction

Nunopi is designed as an agent-backed code learning UI.

```txt
User code input
  ↓
Translator Orchestrator
  ↓
Agent Provider Adapter
  ├─ local-rules
  ├─ Claude Agent SDK / Claude Code
  ├─ Codex server
  ├─ Hermes / local LLM
  └─ OpenAI-compatible endpoint
  ↓
Line explanations + token dictionary + concept notes
```

Core direction:

- Connect AI agents and local rules through the same provider interface.
- Support swappable providers such as Claude, Codex, Hermes, and local LLMs.
- Keep the existing rule-based translator as a local fallback provider.
- Normalize every provider result into the same learning UI.
- Keep source-code storage off by default.
- Clearly show when code may be sent to a remote provider.

## Current Status

Nunopi is currently in the early MVP stage.

- Next.js app initialized
- AppShell layout implemented
- Core translator types defined
- Language detection heuristics implemented and review fixes applied
- Product direction pivoted to an agent-backed architecture on 2026-05-16

Next implementation target:

```txt
Issue 005 — Define agent provider types and normalized response schema
```

## Planned Features

- Code input area
- Line-by-line code explanations
- Code token dictionary
- Beginner-friendly concept dictionary
- Provider selector UI
- Local-rules fallback analysis
- Claude Agent SDK adapter PoC
- Codex agent provider PoC
- Hermes/local LLM or OpenAI-compatible endpoint integration
- Optional local history and bookmarks

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

## Docs

Project documents are maintained locally at:

```txt
/Users/hong/projects/docs/nunopi
```

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS

## Repository

```txt
https://github.com/h1tTAKA/nunopi
```
