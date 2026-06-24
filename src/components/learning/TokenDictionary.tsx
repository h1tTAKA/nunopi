"use client";

import { useState } from "react";
import type { BookmarkedTokenDetail } from "@/lib/bookmarkDetails";
import type { TokenCategory } from "@/lib/translator/types";
import { StarIcon } from "./icons";
import CodeBlock from "./CodeBlock";

interface TokenDictionaryProps {
  details: Record<string, BookmarkedTokenDetail>;
  onUnbookmark: (tokenText: string) => void;
}

type SortMode = "latest" | "oldest" | "alpha";

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

export default function TokenDictionary({ details, onUnbookmark }: TokenDictionaryProps) {
  const [sortMode, setSortMode] = useState<SortMode>("latest");

  const entries = Object.values(details);

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
        북마크한 토큰이 없다.<br />
        <span className="text-xs">토큰 카드의 ★ 버튼으로 북마크할 수 있다.</span>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    if (sortMode === "latest") return new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime();
    if (sortMode === "oldest") return new Date(a.bookmarkedAt).getTime() - new Date(b.bookmarkedAt).getTime();
    return a.token.localeCompare(b.token, "ko");
  });

  // category별 그룹핑
  const grouped: Record<string, BookmarkedTokenDetail[]> = {};
  for (const entry of sorted) {
    const cat = entry.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(entry);
  }

  const SORT_LABELS: Record<SortMode, string> = { latest: "최신순", oldest: "과거순", alpha: "가나다순" };

  return (
    <div className="space-y-4">
      {/* 정렬 컨트롤 */}
      <div className="flex gap-1.5">
        {(["latest", "oldest", "alpha"] as SortMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setSortMode(mode)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              sortMode === mode
                ? "bg-zinc-800 text-zinc-50 dark:bg-zinc-200 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {SORT_LABELS[mode]}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">{entries.length}개</span>
      </div>

      {/* 카테고리별 목록 */}
      {Object.entries(grouped).map(([category, tokens]) => (
        <div key={category} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {CATEGORY_LABEL[category as TokenCategory] ?? category}
            </span>
            <span className="text-xs text-zinc-300 dark:text-zinc-600">({tokens.length})</span>
          </div>
          {tokens.map((token) => (
            <div
              key={token.token}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
                      {token.token}
                    </code>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{token.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{token.description}</p>
                  {token.example && (
                    <CodeBlock code={token.example} className="mt-1.5" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onUnbookmark(token.token)}
                  className="shrink-0 text-lime-600 transition hover:text-zinc-400 dark:text-lime-400 dark:hover:text-zinc-500"
                  title="북마크 해제"
                  aria-label={`${token.token} 북마크 해제`}
                >
                  <StarIcon filled />
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
