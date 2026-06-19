"use client";

import { useState } from "react";
import type { CodeToken, TokenCategory } from "@/lib/translator/types";
import CodeBlock from "./CodeBlock";

const DEFAULT_VISIBLE = 6;

interface TokenSectionProps {
  tokens: CodeToken[];
  activeTokenIds?: string[];
  onTokenClick?: (tokenId: string, conceptId: string | undefined) => void;
  bookmarkedTokenTexts?: string[];
  onBookmarkToggle?: (token: CodeToken) => void;
  // 토큰 호버 시 강조할 코드 줄들(떼면 null). 에디터 하이라이트 연동.
  onTokenHover?: (lines: number[] | null) => void;
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

export default function TokenSection({ tokens, activeTokenIds, onTokenClick, bookmarkedTokenTexts, onBookmarkToggle, onTokenHover }: TokenSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleTokens = showAll ? tokens : tokens.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = tokens.length - DEFAULT_VISIBLE;

  if (tokens.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        토큰이 없다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
      {visibleTokens.map((token) => {
        const isActive = activeTokenIds?.includes(token.id) ?? false;
        const isBookmarked = bookmarkedTokenTexts?.includes(token.token) ?? false;
        return (
          <div
            key={token.id}
            onMouseEnter={() => onTokenHover?.(token.lines)}
            onMouseLeave={() => onTokenHover?.(null)}
            className={`relative rounded-2xl border transition ${
              isBookmarked
                ? "border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/20"
                : isActive
                  ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                  : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            {token.bookmarkable && (
              <button
                type="button"
                onClick={() => onBookmarkToggle?.(token)}
                className="absolute right-2.5 top-2.5 text-base leading-none text-zinc-400 hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400"
                title={isBookmarked ? "북마크 해제" : "북마크"}
                aria-label={isBookmarked ? `${token.token} 북마크 해제` : `${token.token} 북마크 추가`}
              >
                {isBookmarked ? "★" : "☆"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onTokenClick?.(token.id, token.conceptId)}
              className={`w-full p-4 text-left ${token.bookmarkable ? "pr-8" : ""}`}
              aria-label={`${token.token} 토큰 선택`}
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
                <div className="mt-2">
                  <CodeBlock code={token.example} />
                </div>
              )}
              {token.lines.length > 0 && (
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                  등장: {token.lines.join(", ")}번 줄
                </p>
              )}
            </button>
          </div>
        );
      })}
      </div>
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          더 보기 ({hiddenCount}개 더)
        </button>
      )}
      {showAll && tokens.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          접기
        </button>
      )}
    </div>
  );
}
