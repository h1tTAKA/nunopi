# Nunopi

An AI-powered code learning tool for vibe coders — paste code, get line-by-line explanations, a token dictionary, and concept notes.

## Why

Vibe coding produces working code fast, but often leaves you with code you don't fully understand.

Nunopi is built for those moments:

- You want to know what each line does.
- You want quick explanations for tokens like `useState`, `props`, `async`, or `className`.
- You want AI-generated code explained in beginner-friendly language.

## Product Direction

Nunopi is a local-first, agent-backed code learning app.

```txt
Local web app  →  Desktop app  →  Vercel for demo/landing/PR preview
```

Users connect the AI tools they already have:

| Provider | Type |
|---|---|
| Claude Agent SDK | Local process (remote API) |
| Codex / OpenAI app-server | Local process (remote API) |
| OpenAI API key | Remote API |
| Hermes / Ollama / LM Studio / LiteLLM | Local LLM |
| OpenAI-compatible endpoint | User-configured |
| local-rules | Local fallback (no network required) |

## Current Status

MVP feature-complete on the web app layer.

| Feature | Status |
|---|---|
| AppShell layout | ✅ |
| Language detection | ✅ |
| Agent provider contract + orchestrator | ✅ |
| Local rules provider (fallback) | ✅ |
| Agent bridge API route | ✅ |
| UI → agent analyze API connection | ✅ |
| Claude Agent SDK adapter (PoC) | ✅ |
| OpenAI-compatible adapter (PoC) | ✅ |
| Codex provider scaffold | ✅ |
| Provider selector UI | ✅ |
| LearningPanel — line explanations | ✅ |
| LearningPanel — token dictionary cards | ✅ |
| LearningPanel — concept cards | ✅ |
| Desktop shell (Tauri) | 🔜 M3A |

## Architecture

```txt
User code input
  ↓
Provider selector UI
  ↓
POST /api/agent/analyze
  ↓
Translator Orchestrator
  ↓
Agent Provider Adapter
  ├─ local-rules (default fallback)
  ├─ claude-agent (PoC)
  ├─ codex-agent (scaffold)
  └─ openai-compatible (PoC)
  ↓
AgentAnalyzeResponse
  ↓
LearningPanel
  ├─ LineExplanationList
  ├─ TokenSection
  └─ ConceptSection
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev     # development server
npm run build   # production build
npm run lint    # ESLint
```

## Stack

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS

## Repository

[https://github.com/h1tTAKA/nunopi](https://github.com/h1tTAKA/nunopi)
