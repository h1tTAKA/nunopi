import { useState } from "react";
import type { AnalyzeMode, ProviderSettings } from "@/lib/agent";
import { XIcon, BanIcon } from "@/components/learning/icons";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProviderSettings;
  onSave: (next: ProviderSettings) => void;
  excludedTerms?: string[];
  onRemoveExclusion?: (mode: AnalyzeMode, text: string) => void;
}

// 제외 그룹 1개(코드 토큰 / IT 용어) — 칩 + ✕ 해제.
function ExclusionGroup({
  label,
  items,
  onRemove,
}: {
  label: string;
  items: string[];
  onRemove: (text: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {label} ({items.length})
      </span>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">제외한 항목이 없다.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((text) => (
            <span
              key={text}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <code className="font-mono">{text}</code>
              <button
                type="button"
                onClick={() => onRemove(text)}
                className="text-zinc-400 transition hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                title="제외 해제"
                aria-label={`${text} 제외 해제`}
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsDrawer({
  isOpen,
  onClose,
  settings,
  onSave,
  excludedTerms = [],
  onRemoveExclusion,
}: SettingsDrawerProps) {
  const [baseUrl, setBaseUrl] = useState(
    settings["openai-compatible"]?.baseUrl ?? "http://localhost:11434/v1",
  );
  const [model, setModel] = useState(
    settings["openai-compatible"]?.model ?? "hermes-3",
  );
  const [apiKey, setApiKey] = useState(
    settings["openai-compatible"]?.apiKey ?? "",
  );
  const [claudeCliPath, setClaudeCliPath] = useState(
    settings["claude-agent"]?.cliPath ?? "",
  );
  const [codexCliPath, setCodexCliPath] = useState(
    settings["codex-agent"]?.cliPath ?? "",
  );

  if (!isOpen) return null;

  function handleSave() {
    onSave({
      "openai-compatible": {
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      },
      "claude-agent": {
        cliPath: claudeCliPath.trim() || undefined,
      },
      "codex-agent": {
        cliPath: codexCliPath.trim() || undefined,
      },
    });
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl dark:bg-[#111219]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Provider 설정
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="설정 닫기"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              OpenAI-Compatible
            </h3>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Endpoint URL
              </span>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
              />
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Ollama: http://localhost:11434/v1
              </p>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                모델
              </span>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="hermes-3"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                API Key{" "}
                <span className="text-zinc-400 dark:text-zinc-500">(선택)</span>
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
              />
            </label>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Claude Agent
            </h3>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                CLI 경로{" "}
                <span className="text-zinc-400 dark:text-zinc-500">(선택)</span>
              </span>
              <input
                type="text"
                value={claudeCliPath}
                onChange={(e) => setClaudeCliPath(e.target.value)}
                placeholder="/usr/local/bin/claude"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
              />
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                비워두면 PATH에서 자동 탐색
              </p>
            </label>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Codex Agent
            </h3>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                CLI 경로{" "}
                <span className="text-zinc-400 dark:text-zinc-500">(선택)</span>
              </span>
              <input
                type="text"
                value={codexCliPath}
                onChange={(e) => setCodexCliPath(e.target.value)}
                placeholder="/usr/local/bin/codex"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
              />
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                비워두면 PATH에서 자동 탐색
              </p>
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              제외 목록
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              글 분석에서 <BanIcon className="inline-block h-3.5 w-3.5 align-[-2px]" />로 제외한 IT 용어는 다음 분석부터 표시되지 않는다. <XIcon className="inline-block h-3.5 w-3.5 align-[-2px]" />로 해제하면 다시 나온다.
            </p>
            <ExclusionGroup
              label="IT 용어"
              items={excludedTerms}
              onRemove={(text) => onRemoveExclusion?.("text", text)}
            />
          </section>

          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            설정값은 브라우저 localStorage에 저장된다.
          </p>
        </div>

        <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-50 transition hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
          >
            저장
          </button>
        </div>
      </div>
    </>
  );
}
