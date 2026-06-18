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

export interface AgentAnalyzeCallOptions {
  // 분석 취소용. fire되면 provider는 진행 중인 작업(CLI 프로세스/HTTP 요청)을 중단한다.
  signal?: AbortSignal;
}

export interface AgentProvider {
  metadata: AgentProviderMetadata;
  analyze(
    request: import("./schema").AgentAnalyzeRequest,
    options?: AgentAnalyzeCallOptions,
  ): Promise<import("./schema").AgentAnalyzeResponse>;
}
