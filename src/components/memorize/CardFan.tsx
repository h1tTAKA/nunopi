"use client";

// 남은 카드 부채꼴 — 장식용(상호작용 없음). 하단 피벗 기준 rotate로 펼침.
// 장수 많으면 상한(MAX_FAN)만 그리고 초과분은 "+N".
const MAX_FAN = 12;

export default function CardFan({ remaining }: { remaining: number }) {
  if (remaining <= 0) return <div className="h-20" aria-hidden />;
  const shown = Math.min(remaining, MAX_FAN);
  const overflow = remaining - shown;
  // 중앙 기준 대칭 각도 — 장수 적으면 좁게, 많으면 ±28°.
  const spread = Math.min(28, shown * 3);
  const step = shown > 1 ? (spread * 2) / (shown - 1) : 0;

  return (
    <div className="relative flex h-20 w-full items-end justify-center" aria-label={`남은 ${remaining}장`}>
      {Array.from({ length: shown }).map((_, i) => {
        const angle = shown > 1 ? -spread + step * i : 0;
        return (
          <span
            key={i}
            className="absolute bottom-0 h-16 w-11 rounded-md border border-zinc-300 bg-gradient-to-b from-zinc-50 to-zinc-200 shadow-sm dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900"
            style={{ transform: `rotate(${angle}deg) translateY(-6px)`, transformOrigin: "bottom center" }}
          />
        );
      })}
      {overflow > 0 && (
        <span className="absolute -right-1 top-0 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          +{overflow}
        </span>
      )}
    </div>
  );
}
