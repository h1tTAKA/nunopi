"use client";

import CardBack from "./CardBack";

// 남은 카드 부채꼴 — 실제 남은 장수만큼, 가운데 카드 뒤에 넓게 펼쳐 크라운처럼.
// 카드 크기는 가운데 카드와 비슷하게(가려도 옆/위로 삐져나와 보이게 넓은 각도).
const MAX_FAN = 24;

export default function CardFan({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null;
  const n = Math.min(remaining, MAX_FAN);
  // 넓게 펼쳐야 가운데 카드 밖으로 삐져나온다(최대 ±78°).
  const spread = n === 1 ? 0 : Math.min(78, 14 + n * 4);
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
              className="absolute aspect-[5/7] w-64 rounded-2xl border border-zinc-200 shadow-lg"
              style={{
                // 아래 중앙 피벗 기준 회전 → 위로 아치. 가운데 카드보다 살짝 위로 올려 크라운.
                transform: `translate(-50%, -104%) rotate(${angle}deg)`,
                transformOrigin: "bottom center",
                left: 0,
                top: 0,
              }}
            >
              <CardBack />
            </span>
          );
        })}
      </div>
    </div>
  );
}
