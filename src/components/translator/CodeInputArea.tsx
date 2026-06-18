import type { AgentProviderKind, AgentProviderMetadata } from "@/lib/agent";
import { PROVIDER_CATALOG } from "@/lib/agent/catalog";
import type { SupportedLanguage } from "@/lib/translator/types";
import CodeEditor from "./CodeEditor";

export type LanguageChoice =
  | "auto"
  | "react"
  | "typescript"
  | "javascript"
  | "css"
  | "tailwindcss";

const LANGUAGE_OPTIONS: { value: LanguageChoice; label: string }[] = [
  { value: "auto", label: "자동 감지" },
  { value: "react", label: "React (JSX)" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "css", label: "CSS" },
  { value: "tailwindcss", label: "Tailwind CSS" },
];

interface CodeInputAreaProps {
  code: string;
  providerId: AgentProviderKind;
  isLoading: boolean;
  errorMessage: string | null;
  hasResult: boolean;
  languageChoice: LanguageChoice;
  editorLanguage: SupportedLanguage;
  onLanguageChoiceChange: (choice: LanguageChoice) => void;
  onCodeChange: (nextCode: string) => void;
  onProviderChange: (providerId: AgentProviderKind) => void;
  onAnalyze: () => void | Promise<void>;
  onSettingsOpen: () => void;
}

export default function CodeInputArea({
  code,
  providerId,
  isLoading,
  errorMessage,
  hasResult,
  languageChoice,
  editorLanguage,
  onLanguageChoiceChange,
  onCodeChange,
  onProviderChange,
  onAnalyze,
  onSettingsOpen,
}: CodeInputAreaProps) {
  const isAnalyzeDisabled = isLoading || code.trim().length === 0;
  const providerMeta = PROVIDER_CATALOG.find((p) => p.id === providerId);

  return (
    <div className="h-full p-8 flex flex-col gap-6 bg-zinc-50 dark:bg-black">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Nunopi
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          코드를 붙여넣고, 어떤 provider로 분석할지 고른 뒤 실제 agent bridge API에 분석을 요청한다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              코드 입력
            </span>
            <div className="flex items-center gap-3">
              <select
                value={languageChoice}
                disabled={isLoading}
                onChange={(event) =>
                  onLanguageChoiceChange(event.target.value as LanguageChoice)
                }
                aria-label="코드 언어 선택"
                title={
                  languageChoice === "auto"
                    ? `자동 감지: ${editorLanguage}`
                    : "코드 언어 선택"
                }
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-500"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {code.trim().split(/\r?\n/).filter(Boolean).length} lines
              </span>
            </div>
          </div>
          <CodeEditor
            value={code}
            onChange={onCodeChange}
            language={editorLanguage}
            readOnly={isLoading}
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <label className="block space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                분석 provider
              </span>
              <button
                type="button"
                onClick={onSettingsOpen}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Provider 설정"
                aria-label="Provider 설정 열기"
              >
                ⚙
              </button>
            </div>
            <select
              value={providerId}
              disabled={isLoading}
              onChange={(event) =>
                onProviderChange(event.target.value as AgentProviderKind)
              }
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
            >
              {PROVIDER_CATALOG.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              void onAnalyze();
            }}
            disabled={isAnalyzeDisabled}
            className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-50 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {isLoading ? "분석 요청 중..." : "분석 요청하기"}
          </button>

          {providerMeta ? (
            <ProviderInfoBadges providerMeta={providerMeta} />
          ) : null}

          {hasResult ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-300">
              현재 결과는 지금 입력한 코드 기준이다. 코드를 수정하거나 provider를 바꾸면 이전 결과는 지워진다.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
              <p>{errorMessage}</p>
              <button
                type="button"
                onClick={() => { void onAnalyze(); }}
                className="mt-2 font-medium underline hover:no-underline"
              >
                다시 시도
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProviderInfoBadges({
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
    <div className="space-y-2">
      <div
        className={
          isRemote
            ? "rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300"
            : "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
        }
      >
        {isRemote ? "⚠ " : "✓ "}
        {dataHandlingLabel}
      </div>

      {providerMeta.capabilities.requiresLocalProcess ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          이 provider는 로컬 CLI 설치가 필요함
        </div>
      ) : null}
    </div>
  );
}
