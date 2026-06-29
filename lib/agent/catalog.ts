import type { AgentProviderMetadata } from "./types";

// NOTE: Metadata here duplicates what's defined in each provider file.
// This is intentional — provider files use node:fs and cannot be imported
// by client components. Keep this in sync when provider metadata changes.
export const PROVIDER_CATALOG: readonly AgentProviderMetadata[] = [
  {
    id: "claude-agent",
    label: "Claude Code",
    description:
      "Provider scaffold for Claude Agent SDK or Claude Code based analysis in the user's local environment.",
    executionLocation: "local-server",
    dataHandling: "remote-provider",
    capabilities: {
      streaming: false,
      cancellation: false,
      fileSystemAccess: false,
      shellAccess: true,
      requiresApiKey: false,
      requiresLocalProcess: true,
    },
  },
  {
    id: "codex-agent",
    label: "Codex",
    description:
      "Provider scaffold for OpenAI Codex CLI or app-server based analysis in the user's local environment.",
    executionLocation: "local-server",
    dataHandling: "remote-provider",
    capabilities: {
      streaming: false,
      cancellation: false,
      fileSystemAccess: false,
      shellAccess: true,
      requiresApiKey: false,
      requiresLocalProcess: true,
    },
  },
  {
    id: "opencode-agent",
    label: "OpenCode",
    description:
      "OpenCode agentic CLI runtime via the embedded runtime server. Model set by NUNOPI_OPENCODE_MODEL (default opencode/deepseek-v4-flash-free).",
    executionLocation: "local-server",
    dataHandling: "remote-provider",
    capabilities: {
      streaming: true,
      cancellation: true,
      fileSystemAccess: false,
      shellAccess: false,
      requiresApiKey: false,
      requiresLocalProcess: true,
    },
  },
  {
    id: "openai-compatible",
    label: "Local LLM",
    description:
      "Provider scaffold for OpenAI-style local or remote LLM endpoints such as Ollama gateways, vLLM, LiteLLM, or Hermes servers.",
    executionLocation: "local-server",
    dataHandling: "user-configured-endpoint",
    capabilities: {
      streaming: false,
      cancellation: false,
      fileSystemAccess: false,
      shellAccess: false,
      requiresApiKey: false,
      requiresLocalProcess: false,
    },
  },
];
