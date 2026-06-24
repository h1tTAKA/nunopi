import { IconSettings } from "@tabler/icons-react";
import type { AgentProviderKind, AgentProviderMetadata, AnalyzeMode } from "@/lib/agent";
import { PROVIDER_CATALOG } from "@/lib/agent/catalog";

interface ProviderToolbarProps {
  mode: AnalyzeMode;
  providerId: AgentProviderKind;
  isLoading: boolean;
  errorMessage: string | null;
  onModeChange: (mode: AnalyzeMode) => void;
  onProviderChange: (providerId: AgentProviderKind) => void;
  onAnalyze: () => void | Promise<void>;
  onCancel: () => void;
  onSettingsOpen: () => void;
  // 멈춰서 부분 결과만 있는 상태 → "이어서 분석" 노출.
  resumable?: boolean;
  onResume?: () => void;
}

const MODE_OPTIONS: { value: AnalyzeMode; label: string }[] = [
  { value: "code", label: "코드 분석" },
  { value: "text", label: "글 분석" },
];

export default function ProviderToolbar({
  mode,
  providerId,
  isLoading,
  errorMessage,
  onModeChange,
  onProviderChange,
  onAnalyze,
  onCancel,
  onSettingsOpen,
  resumable = false,
  onResume,
}: ProviderToolbarProps) {
  const providerMeta = PROVIDER_CATALOG.find((p) => p.id === providerId);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 모드 토글 — 코드 분석 / 글(IT 용어) 분석. 히스토리·북마크는 모드별로 분리(Issue 76). */}
      <div
        role="tablist"
        aria-label="분석 모드"
        className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {MODE_OPTIONS.map((opt) => {
          const selected = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={isLoading}
              onClick={() => onModeChange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void onAnalyze();
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            분석 요청하기
          </button>
          {resumable && onResume ? (
            <button
              type="button"
              onClick={onResume}
              className="rounded-xl border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
              title="멈춘 지점부터 안 된 부분만 이어서 분석"
            >
              ▸ 이어서 분석
            </button>
          ) : null}
        </div>
      )}

      <button
        type="button"
        onClick={onSettingsOpen}
        className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        title="Provider 설정"
        aria-label="Provider 설정 열기"
      >
        <IconSettings size={18} stroke={2} aria-hidden />
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
