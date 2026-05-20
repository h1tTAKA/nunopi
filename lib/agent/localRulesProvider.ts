import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProvider } from "./types";

export const localRulesProvider: AgentProvider = {
  metadata: {
    id: "local-rules",
    label: "Local Rules",
    description: "Built-in rule-based analysis without external API calls.",
    executionLocation: "browser",
    dataHandling: "local-only",
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
      summary: "Local rules provider skeleton is connected, but rule-based analysis is not implemented yet.",
      lineExplanations: [],
      tokens: [],
      concepts: [],
      warnings: [
        {
          code: "PARTIAL_PARSE",
          message: "Local rules provider is connected, but detailed rule-based analysis will be added in the next step.",
        },
      ],
      createdAt: new Date().toISOString(),
    };
  },
};
