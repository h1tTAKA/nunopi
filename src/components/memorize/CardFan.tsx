"use client";

// 남은 카드 부채꼴 — 실제 남은 장수만큼, 가운데 카드 뒤 배경으로 넓게 펼침.
// 하단 한 점을 피벗으로 rotate시켜 트럼프 손패처럼 아치.
const MAX_FAN = 24; // 레이아웃 안전 상한(초과분은 그냥 이 각도 안에 더 촘촘히)

export default function CardFan({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null;
  const n = Math.min(remaining, MAX_FAN);
  // 장수 많을수록 넓게(최대 ±62°). 1장이면 0°.
  const spread = n === 1 ? 0 : Math.min(62, 8 + n * 3);
  const step = n > 1 ? (spread * 2) / (n - 1) : 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-center" aria-hidden>
      {/* 피벗: 카드 아래쪽 한 점. 카드들이 그 위로 아치. */}
      <div className="relative h-0 w-0">
        {Array.from({ length: n }).map((_, i) => {
          const angle = n > 1 ? -spread + step * i : 0;
          return (
            <span
              key={i}
              className="absolute h-52 w-36 rounded-xl border border-zinc-300 bg-gradient-to-b from-white to-zinc-100 shadow-md dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-950"
              style={{
                // 아래 중앙 피벗 기준으로 회전 → 위로 아치. translateY로 카드 뒤로 올림.
                transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                transformOrigin: "bottom center",
                left: 0,
                top: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
