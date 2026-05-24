import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProvider } from "./types";

export const claudeAgentProvider: AgentProvider = {
  metadata: {
    id: "claude-agent",
    label: "Claude Agent",
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
  async analyze(request: AgentAnalyzeRequest): Promise<AgentAnalyzeResponse> {
    return {
      providerId: this.metadata.id,
      language: request.detectedLanguage ?? "unknown",
      summary:
        "Claude Agent provider scaffold is registered, but live Claude execution is not connected yet.",
      lineExplanations: [],
      tokens: [],
      concepts: [],
      warnings: [
        {
          code: "PARTIAL_PARSE",
          message:
            "Claude Agent provider scaffold is connected, but the live Claude runtime bridge is not implemented yet.",
        },
      ],
      createdAt: new Date().toISOString(),
    };
  },
};
