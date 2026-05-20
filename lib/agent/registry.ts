import type { TranslatorProviderRegistry } from "@/lib/translator/orchestrator";
import { localRulesProvider } from "./localRulesProvider";
import type { AgentProvider, AgentProviderKind } from "./types";

export interface CreateAgentRegistryOptions {
  providers?: AgentProvider[];
  fallbackProviderId?: AgentProviderKind;
}

export function createAgentRegistry(
  options: CreateAgentRegistryOptions = {},
): TranslatorProviderRegistry {
  const providers = options.providers ?? [localRulesProvider];
  const providerMap = new Map(
    providers.map((provider) => [provider.metadata.id, provider] as const),
  );
  const fallbackProviderId = options.fallbackProviderId ?? localRulesProvider.metadata.id;

  return {
    getProvider(id) {
      return providerMap.get(id);
    },
    getFallbackProvider() {
      return providerMap.get(fallbackProviderId);
    },
  };
}
