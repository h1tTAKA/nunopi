import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProvider } from "./types";

export const openAICompatibleProvider: AgentProvider = {
  metadata: {
    id: "openai-compatible",
    label: "OpenAI-Compatible",
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
  async analyze(request: AgentAnalyzeRequest): Promise<AgentAnalyzeResponse> {
    return {
      providerId: this.metadata.id,
      language: request.detectedLanguage ?? "unknown",
      summary:
        "OpenAI-compatible provider scaffold is registered, but endpoint request building is not connected yet.",
      lineExplanations: [],
      tokens: [],
      concepts: [],
      warnings: [
        {
          code: "PARTIAL_PARSE",
          message:
            "OpenAI-compatible provider scaffold is connected, but the live endpoint request/response bridge is not implemented yet.",
        },
      ],
      createdAt: new Date().toISOString(),
    };
  },
};
