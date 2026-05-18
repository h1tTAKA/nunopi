export type AgentProviderKind =
  | "local-rules"
  | "claude-agent"
  | "codex-agent"
  | "openai-app-server"
  | "openai-api-key"
  | "hermes-local"
  | "openai-compatible"
  | "mock";

export type AgentExecutionLocation =
  | "browser"
  | "local-server"
  | "desktop"
  | "remote-api";

export type AgentDataHandling =
  | "local-only"
  | "user-configured-endpoint"
  | "remote-provider";

export interface AgentProviderCapability {
  streaming: boolean;
  cancellation: boolean;
  fileSystemAccess: boolean;
  shellAccess: boolean;
  requiresApiKey: boolean;
  requiresLocalProcess: boolean;
}

export interface AgentProviderMetadata {
  id: AgentProviderKind;
  label: string;
  description: string;
  executionLocation: AgentExecutionLocation;
  dataHandling: AgentDataHandling;
  capabilities: AgentProviderCapability;
}

export interface AgentProvider {
  metadata: AgentProviderMetadata;
  analyze(
    request: import("./schema").AgentAnalyzeRequest,
  ): Promise<import("./schema").AgentAnalyzeResponse>;
}
