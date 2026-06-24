import { IconLock, IconMessageCircle } from "@tabler/icons-react";
import type { SupportedLanguage } from "@/lib/translator/types";
import type { AgentProviderKind } from "@/lib/agent";
import CodeEditor from "./CodeEditor";
import { ProviderSelect, AnalyzeButton, AnalyzeError } from "./AnalyzeControls";

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
  isLoading: boolean;
  languageChoice: LanguageChoice;
  editorLanguage: SupportedLanguage;
  onLanguageChoiceChange: (choice: LanguageChoice) => void;
  onCodeChange: (nextCode: string) => void;
  activeLine?: number | null;
  onLineClick?: (line: number) => void;
  markedLines?: number[];
  chatOpen?: boolean;
  onToggleChat?: () => void;
  // 분석 결과가 있으면 입력 잠금(실수 수정 방지). 클리어로만 새 입력.
  locked?: boolean;
  onClear?: () => void;
  // 분석 컨트롤 — 툴바 strip 해체로 입력 헤더에 들어옴.
  providerId: AgentProviderKind;
  onProviderChange: (id: AgentProviderKind) => void;
  onAnalyze: () => void | Promise<void>;
  onCancel: () => void;
  resumable?: boolean;
  onResume?: () => void;
  errorMessage?: string | null;
}

export default function CodeInputArea({
  code,
  isLoading,
  languageChoice,
  editorLanguage,
  onLanguageChoiceChange,
  onCodeChange,
  activeLine = null,
  onLineClick,
  markedLines,
  chatOpen,
  onToggleChat,
  locked = false,
  onClear,
  providerId,
  onProviderChange,
  onAnalyze,
  onCancel,
  resumable = false,
  onResume,
  errorMessage = null,
}: CodeInputAreaProps) {
  return (
    <div className="flex h-full flex-col gap-2 bg-white p-4 dark:bg-[#111219]">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          코드 입력
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <ProviderSelect providerId={providerId} onProviderChange={onProviderChange} disabled={isLoading} />
          <select
            value={languageChoice}
            disabled={isLoading || locked}
            onChange={(event) =>
              onLanguageChoiceChange(event.target.value as LanguageChoice)
            }
            aria-label="코드 언어 선택"
            title={
              languageChoice === "auto"
                ? `자동 감지: ${editorLanguage}`
                : "코드 언어 선택"
            }
            className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-500"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <AnalyzeButton
            isLoading={isLoading}
            resumable={resumable}
            onAnalyze={onAnalyze}
            onCancel={onCancel}
            onResume={onResume}
          />
          {locked && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-red-100 hover:text-red-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              title="입력을 비우고 새 코드를 분석"
            >
              <IconLock size={14} stroke={2} aria-hidden /> 클리어
            </button>
          )}
          {onToggleChat && (
            <button
              type="button"
              onClick={onToggleChat}
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium transition ${
                chatOpen
                  ? "bg-lime-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
              title="학습 챗 열기/닫기"
            >
              <IconMessageCircle size={14} stroke={2} aria-hidden /> 질문
            </button>
          )}
          {errorMessage && <AnalyzeError message={errorMessage} onRetry={onAnalyze} />}
        </div>
      </div>

      {/* flex-1로 데스크톱 높이를 채우고, 모바일(높이 미고정)에선 min-h로 바닥 확보 */}
      <div className="min-h-[320px] flex-1">
        <CodeEditor
          value={code}
          onChange={onCodeChange}
          language={editorLanguage}
          readOnly={isLoading || locked}
          fill
          activeLine={activeLine}
          onLineClick={onLineClick}
          markedLines={markedLines}
        />
      </div>
    </div>
  );
}
