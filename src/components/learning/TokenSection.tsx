import type { CodeToken, TokenCategory } from "@/lib/translator/types";

interface TokenSectionProps {
  tokens: CodeToken[];
  activeTokenId?: string | null;
  onTokenClick?: (tokenId: string, conceptId: string | undefined) => void;
}

const CATEGORY_LABEL: Record<TokenCategory, string> = {
  react_hook: "훅",
  state_variable: "상태 변수",
  state_setter: "상태 세터",
  prop: "prop",
  function: "함수",
  event_handler: "이벤트 핸들러",
  jsx_element: "JSX 요소",
  operator: "연산자",
  keyword: "키워드",
  api_call: "API 호출",
  dependency_array: "의존성 배열",
  initial_value: "초기값",
  css_selector: "CSS 선택자",
  css_property: "CSS 속성",
  css_value: "CSS 값",
  tailwind_utility: "Tailwind",
  tailwind_layout: "Tailwind 레이아웃",
  tailwind_spacing: "Tailwind 간격",
  tailwind_color: "Tailwind 색상",
  tailwind_responsive: "Tailwind 반응형",
  tailwind_state: "Tailwind 상태",
};

export default function TokenSection({ tokens, activeTokenId, onTokenClick }: TokenSectionProps) {
  if (tokens.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        토큰이 없다.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tokens.map((token) => (
        <button
          key={token.id}
          type="button"
          onClick={() => onTokenClick?.(token.id, token.conceptId)}
          className={`w-full rounded-2xl border p-4 text-left transition ${
            activeTokenId === token.id
              ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
              : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
              {token.token}
            </code>
            <span className="inline-flex items-center rounded-lg bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {CATEGORY_LABEL[token.category] ?? token.category}
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {token.label}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            {token.description}
          </p>
          {token.example && (
            <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-2 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
              {token.example}
            </pre>
          )}
          {token.lines.length > 0 && (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              등장: {token.lines.join(", ")}번 줄
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
