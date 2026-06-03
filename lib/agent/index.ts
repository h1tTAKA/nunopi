export type {
  AgentDataHandling,
  AgentExecutionLocation,
  AgentProvider,
  AgentProviderCapability,
  AgentProviderKind,
  AgentProviderMetadata,
} from "./types";
export type {
  AgentAnalyzeOptions,
  AgentAnalyzeRequest,
  AgentAnalyzeResponse,
  AgentLineExplanation,
  AgentToTranslateMapping,
  AgentUsage,
} from "./schema";
export { claudeAgentProvider } from "./claudeAgentProvider";
export { codexAgentProvider } from "./codexAgentProvider";
export { localRulesProvider } from "./localRulesProvider";
export { openAICompatibleProvider } from "./openAICompatibleProvider";
export { createAgentRegistry } from "./registry";
export type { CreateAgentRegistryOptions } from "./registry";

import { claudeAgentProvider } from "./claudeAgentProvider";
import { codexAgentProvider } from "./codexAgentProvider";
import { localRulesProvider } from "./localRulesProvider";
import { openAICompatibleProvider } from "./openAICompatibleProvider";

export const PROVIDER_CATALOG = [
  localRulesProvider,
  claudeAgentProvider,
  codexAgentProvider,
  openAICompatibleProvider,
] as const;
