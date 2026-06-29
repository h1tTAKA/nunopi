export type AgentProviderKind =
  | "claude-agent"
  | "codex-agent"
  | "opencode-agent"
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
  // 진행 출력 한 줄씩 흘리는 콜백(예: CLI provider의 stdout 라인). 실시간 상태 표시용.
  onProgress?: (line: string) => void;
  // 누적 부분 결과 콜백(청크 분석 전용) — outline·청크가 완료될 때마다 지금까지의
  // 누적 response를 흘려 화면에 점진 표시한다. 단일 호출 provider는 사용하지 않는다.
  onPartial?: (response: import("./schema").AgentAnalyzeResponse) => void;
  // 청크 진행률 콜백(청크 분석 전용) — 완료 조각 수/전체. 진행률 막대바용.
  onChunkProgress?: (done: number, total: number) => void;
}

export interface AgentProvider {
  metadata: AgentProviderMetadata;
  analyze(
    request: import("./schema").AgentAnalyzeRequest,
    options?: AgentAnalyzeCallOptions,
  ): Promise<import("./schema").AgentAnalyzeResponse>;
}
