"use client";

// 포커카드 뒷면 스타일 — 흰 바탕 + 파란 다이아몬드 격자 + 이중 프레임 + 중앙 심볼.
// 부채꼴/더미의 "카드 뒷면"에 공용으로 쓴다. 부모(카드 span, relative) 안에 꽉 채움.
const LATTICE =
  "repeating-linear-gradient(45deg, rgba(79,110,247,.45) 0 1.5px, transparent 1.5px 8px)," +
  "repeating-linear-gradient(-45deg, rgba(79,110,247,.45) 0 1.5px, transparent 1.5px 8px)";

export default function CardBack({ symbol = true }: { symbol?: boolean }) {
  return (
    <span className="absolute inset-0 overflow-hidden rounded-[inherit] bg-white">
      {/* 안쪽 프레임 + 격자 */}
      <span
        className="absolute inset-[7%] rounded-lg border-2 border-blue-500/50"
        style={{ backgroundImage: LATTICE }}
      />
      {/* 중앙 심볼 배지(흰 원 위) */}
      {symbol && (
        <span className="absolute left-1/2 top-1/2 flex h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-blue-500/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nunopi-symbol-darkeye-transparent.png" alt="" className="h-3/5 w-3/5 object-contain" />
        </span>
      )}
    </span>
  );
}
