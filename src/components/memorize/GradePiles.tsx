"use client";

import { useT } from "@/lib/i18n/I18nProvider";
import type { Grade } from "@/lib/srs/types";

interface GradePilesProps {
  stats: { again: number; hard: number; good: number };
  landing: Grade | null; // 방금 toss된 더미 — 튀는 강조
}

const PILES: { grade: Grade; tKey: string; border: string; text: string; chip: string }[] = [
  { grade: "again", tKey: "mem.again", border: "border-rose-300 dark:border-rose-700", text: "text-rose-500 dark:text-rose-400", chip: "bg-rose-500" },
  { grade: "hard", tKey: "mem.hard", border: "border-amber-300 dark:border-amber-700", text: "text-amber-500 dark:text-amber-400", chip: "bg-amber-500" },
  { grade: "good", tKey: "mem.good", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-500 dark:text-emerald-400", chip: "bg-emerald-500" },
];

// 다시/애매/완벽 3더미 — 채점 카드가 날아와 쌓이는 곳(우측). 카운트만큼 카드가 겹쳐 쌓임.
export default function GradePiles({ stats, landing }: GradePilesProps) {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      {PILES.map(({ grade, tKey, border, text, chip }) => {
        const n = stats[grade];
        const stack = Math.min(n, 6); // 시각 상한
        const active = landing === grade;
        return (
          <div key={grade} className="flex items-center gap-3">
            {/* 더미 그림 — 카드가 살짝 어긋나게 쌓임 */}
            <div className="relative h-28 w-24 shrink-0">
              {n === 0 ? (
                <span className={`absolute left-0 top-2 h-20 w-14 rounded-lg border-2 border-dashed ${border} opacity-40`} />
              ) : (
                Array.from({ length: stack }).map((_, i) => {
                  const lift = active && i === stack - 1 ? " translateY(-8px)" : "";
                  const topCard = i === stack - 1;
                  return (
                    <span
                      key={i}
                      className={`absolute flex h-20 w-14 items-center justify-center rounded-lg border-2 bg-white shadow-md transition-transform duration-200 ${border}`}
                      style={{ left: i * 5, top: i * 3, transform: `rotate(${(i - (stack - 1) / 2) * 4}deg)${lift}` }}
                    >
                      {topCard && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src="/brand/nunopi-symbol-transparent.png" alt="" className="h-6 w-6 object-contain opacity-25" />
                      )}
                    </span>
                  );
                })
              )}
            </div>
            {/* 라벨 + 수 */}
            <div className="flex flex-col gap-0.5">
              <span className={`text-sm font-semibold ${text}`}>{t(tKey)}</span>
              <span className={`inline-flex h-5 w-fit min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white ${chip}`}>
                {n}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
