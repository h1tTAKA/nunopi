"use client";

import { IconHelpCircle } from "@tabler/icons-react";

// 물음표 아이콘 + 호버 툴팁(순수 CSS group-hover, JS 상태 없음).
// align: 팝오버가 오른쪽 잘림 방지용으로 기본 우측 정렬(right-0).
export default function HelpTooltip({ text, align = "right" }: { text: string; align?: "left" | "right" }) {
  return (
    <span className="group relative inline-flex align-middle">
      <IconHelpCircle
        size={13}
        stroke={2}
        className="cursor-help text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        aria-hidden
      />
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-30 mt-1 w-52 rounded-lg border border-zinc-200 bg-white p-2 text-[11px] font-normal leading-relaxed text-zinc-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {text}
      </span>
    </span>
  );
}
