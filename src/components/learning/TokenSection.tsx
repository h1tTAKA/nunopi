"use client";

import { useEffect } from "react";
import type { CodeToken, TokenCategory } from "@/lib/translator/types";
import CodeBlock from "./CodeBlock";
import { StarIcon, XIcon } from "./icons";

interface TokenSectionProps {
  tokens: CodeToken[];
  activeTokenIds?: string[];
  onTokenClick?: (tokenId: string, conceptId: string | undefined) => void;
  bookmarkedTokenTexts?: string[];
  onBookmarkToggle?: (token: CodeToken) => void;
  // 토큰 호버 시 강조할 코드 줄들(떼면 null). 에디터 하이라이트 연동.
  onTokenHover?: (lines: number[] | null) => void;
  // 이 토큰 카드를 사전에서 삭제(X) — 다시 태그를 누르면 재호출된다.
  onDelete?: (token: CodeToken) => void;
  // 토큰이 없을 때 보여줄 안내 문구(lazy 사전: 클릭 유도).
  emptyHint?: string;
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
  punctuation: "기호",
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

export default function TokenSection({ tokens, activeTokenIds, onTokenClick, bookmarkedTokenTexts, onBookmarkToggle, onTokenHover, onDelete, emptyHint }: TokenSectionProps) {
  // bounded 스크롤 박스 안에서 전체를 렌더(더보기 없이 스크롤).
  const visibleTokens = tokens;

  // 줄별 설명에서 토큰 태그를 클릭하면 activeTokenIds가 바뀜 → 그 토큰 카드로 스크롤.
  const activeKey = (activeTokenIds ?? []).join(",");
  useEffect(() => {
    const first = activeTokenIds?.[0];
    if (!first) return;
    const el = document.getElementById(`nunopi-token-${first}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  if (tokens.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        {emptyHint ?? "토큰이 없다."}
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
            id={`nunopi-token-${token.id}`}
            onMouseEnter={() => onTokenHover?.(token.lines)}
            onMouseLeave={() => onTokenHover?.(null)}
            className={`relative scroll-mt-2 rounded-2xl border transition ${
              isBookmarked
                ? "border-lime-600 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/20"
                : isActive
                  ? "border-blue-500 bg-blue-100 dark:border-blue-500 dark:bg-blue-950/30"
                  : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className="absolute right-2 top-2.5 flex items-center gap-2">
              {token.bookmarkable && (
                <button
                  type="button"
                  onClick={() => onBookmarkToggle?.(token)}
                  className={`transition ${
                    isBookmarked
                      ? "text-lime-600 dark:text-lime-400"
                      : "text-zinc-400 hover:text-lime-600 dark:text-zinc-500 dark:hover:text-lime-400"
                  }`}
                  title={isBookmarked ? "북마크 해제" : "북마크"}
                  aria-label={isBookmarked ? `${token.token} 북마크 해제` : `${token.token} 북마크 추가`}
                >
                  <StarIcon filled={isBookmarked} />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(token)}
                  className="text-zinc-400 transition hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                  title="사전에서 삭제 (다시 태그를 누르면 다시 불러옴)"
                  aria-label={`${token.token} 사전에서 삭제`}
                >
                  <XIcon />
                </button>
              )}
            </div>
            {/* 헤더(토큰칩+카테고리)만 클릭 영역. 설명/예시는 버튼 밖 → 드래그 복사 가능. */}
            <button
              type="button"
              onClick={() => onTokenClick?.(token.id, token.conceptId)}
              className={`w-full px-4 pt-4 text-left ${token.bookmarkable || onDelete ? "pr-12" : ""}`}
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
            </button>
            <div className="px-4 pb-4">
              <p className="mt-1 select-text text-xs text-zinc-600 dark:text-zinc-300">
                {token.description}
              </p>
              {token.example && (
                <div className="mt-2 select-text">
                  <CodeBlock code={token.example} />
                </div>
              )}
              {token.lines.length > 0 && (
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                  등장: {token.lines.join(", ")}번 줄
                </p>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
