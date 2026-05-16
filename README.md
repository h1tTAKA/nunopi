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

Nunopi is designed as a local-first, agent-backed code learning app.

The core product is not a hosted SaaS. The main path is:

```txt
Local web app first
  ↓
Desktop app next
  ↓
Hosted deployment only for demo, landing, and PR previews
```

Users should be able to connect the AI tools they already use:

- Claude Code or Claude Agent SDK from their own local/authenticated environment
- Codex or an OpenAI app-server style local bridge
- OpenAI API with their own API key
- Hermes, Ollama, LM Studio, vLLM, LiteLLM, or another local/OpenAI-compatible endpoint
- Nunopi's local rules provider as a no-network fallback

High-level architecture:

```txt
User code input
  ↓
Nunopi local web app / desktop app
  ↓
Local Agent Bridge
  ↓
Translator Orchestrator
  ↓
Agent Provider Adapter
  ├─ local-rules
  ├─ Claude Agent SDK / Claude Code
  ├─ Codex / OpenAI app-server
  ├─ OpenAI API key provider
  ├─ Hermes / local LLM
  └─ OpenAI-compatible endpoint
  ↓
Line explanations + token dictionary + concept notes
```

Core direction:

- Connect AI agents and local rules through the same provider interface.
- Prioritize local execution through a local bridge or desktop shell.
- Support swappable providers such as Claude, Codex, OpenAI app-server/API, Hermes, and local LLMs.
- Keep the existing rule-based translator as a local fallback provider.
- Normalize every provider result into the same learning UI.
- Keep source-code storage off by default.
- Clearly show whether code stays local or is sent to a remote API/provider.
- Use Vercel only for public demo, landing, and PR preview deployments.

## Current Status

Nunopi is currently in the early MVP stage.

- Next.js app initialized
- AppShell layout implemented
- Core translator types defined
- Language detection heuristics implemented and review fixes applied
- Product direction pivoted to a local-first agent-backed architecture on 2026-05-16

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
- OpenAI app-server/API key provider
- Hermes/local LLM or OpenAI-compatible endpoint integration
- Desktop app shell, likely Tauri first
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
