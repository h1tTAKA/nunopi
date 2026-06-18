import type { AgentProviderKind, AgentProviderMetadata } from "@/lib/agent";
import { PROVIDER_CATALOG } from "@/lib/agent/catalog";

interface ProviderToolbarProps {
  providerId: AgentProviderKind;
  isLoading: boolean;
  errorMessage: string | null;
  onProviderChange: (providerId: AgentProviderKind) => void;
  onAnalyze: () => void | Promise<void>;
  onCancel: () => void;
  onSettingsOpen: () => void;
}

export default function ProviderToolbar({
  providerId,
  isLoading,
  errorMessage,
  onProviderChange,
  onAnalyze,
  onCancel,
  onSettingsOpen,
}: ProviderToolbarProps) {
  const providerMeta = PROVIDER_CATALOG.find((p) => p.id === providerId);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        분석 provider
      </span>

      <select
        value={providerId}
        disabled={isLoading}
        onChange={(event) =>
          onProviderChange(event.target.value as AgentProviderKind)
        }
        aria-label="분석 provider 선택"
        className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
      >
        {PROVIDER_CATALOG.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {isLoading ? (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          ■ 멈추기
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            void onAnalyze();
          }}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-50 transition hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
        >
          분석 요청하기
        </button>
      )}

      <button
        type="button"
        onClick={onSettingsOpen}
        className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        title="Provider 설정"
        aria-label="Provider 설정 열기"
      >
        ⚙
      </button>

      {providerMeta ? <ProviderDataBadge providerMeta={providerMeta} /> : null}

      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => {
              void onAnalyze();
            }}
            className="font-medium underline hover:no-underline"
          >
            다시 시도
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProviderDataBadge({
  providerMeta,
}: {
  providerMeta: AgentProviderMetadata;
}) {
  const isRemote =
    providerMeta.dataHandling === "remote-provider" ||
    providerMeta.dataHandling === "user-configured-endpoint";

  const dataHandlingLabel =
    providerMeta.dataHandling === "local-only"
      ? "코드가 외부로 전송되지 않음"
      : providerMeta.dataHandling === "remote-provider"
        ? "코드가 AI provider 서버로 전송될 수 있음"
        : "설정한 endpoint로 코드가 전송될 수 있음";

  return (
    <span
      className={
        isRemote
          ? "rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300"
          : "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
      }
    >
      {isRemote ? "⚠ " : "✓ "}
      {dataHandlingLabel}
    </span>
  );
}
