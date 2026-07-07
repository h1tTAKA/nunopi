"use client";

import { useT } from "@/lib/i18n/I18nProvider";
import type { Grade } from "@/lib/srs/types";

interface GradePilesProps {
  stats: { again: number; hard: number; good: number };
  landing: Grade | null; // 방금 toss된 더미 — 살짝 튀는 강조
  row?: boolean; // true면 가로 배치(좁은 화면용)
}

const PILES: { grade: Grade; tKey: string; ring: string; chip: string }[] = [
  { grade: "again", tKey: "mem.again", ring: "border-rose-300 dark:border-rose-800", chip: "bg-rose-500" },
  { grade: "hard", tKey: "mem.hard", ring: "border-amber-300 dark:border-amber-800", chip: "bg-amber-500" },
  { grade: "good", tKey: "mem.good", ring: "border-emerald-300 dark:border-emerald-800", chip: "bg-emerald-500" },
];

// 다시/애매/완벽 3더미 — 채점 카드가 쌓이는 곳. 카운트만큼 카드가 겹쳐 쌓인 그림.
export default function GradePiles({ stats, landing, row = false }: GradePilesProps) {
  const t = useT();
  return (
    <div className={row ? "flex gap-5" : "flex flex-col gap-3"}>
      {PILES.map(({ grade, tKey, ring, chip }) => {
        const n = stats[grade];
        const stack = Math.min(n, 5); // 시각 상한 — 5장까지 겹쳐 표현
        return (
          <div key={grade} className="flex items-center gap-2">
            <div className="relative h-10 w-8">
              {Array.from({ length: Math.max(1, stack) }).map((_, i) => (
                <span
                  key={i}
                  className={`absolute h-9 w-7 rounded-md border bg-white dark:bg-[#15161d] ${ring} ${
                    n === 0 ? "opacity-30" : ""
                  } ${landing === grade && i === stack - 1 ? "transition-transform duration-200 -translate-y-1" : ""}`}
                  style={{ left: i * 2, top: i * 1.5 }}
                />
              ))}
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {t(tKey)}
              <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${chip}`}>
                {n}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
