import type { TranslatorProviderRegistry } from "@/lib/translator/orchestrator";
import type { AgentProvider, AgentProviderKind } from "./types";

export interface CreateAgentRegistryOptions {
  providers?: AgentProvider[];
  fallbackProviderId?: AgentProviderKind;
}

export function createAgentRegistry(
  options: CreateAgentRegistryOptions = {},
): TranslatorProviderRegistry {
  const providers = options.providers ?? [];
  const providerMap = new Map(
    providers.map((provider) => [provider.metadata.id, provider] as const),
  );
  // 폴백 미지정 시 첫 provider(없으면 undefined). route는 providers를 명시 전달한다.
  const fallbackProviderId = options.fallbackProviderId ?? providers[0]?.metadata.id;

  return {
    getProvider(id) {
      return providerMap.get(id);
    },
    getFallbackProvider() {
      return providerMap.get(fallbackProviderId);
    },
  };
}
