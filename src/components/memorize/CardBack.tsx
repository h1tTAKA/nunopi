"use client";

// 부채꼴/더미 카드 — 가운데 플립 카드(앞면)와 같은 디자인: 흰 바탕 + 파란 이중 프레임 + 중앙 심볼.
// 부모(카드 span, relative)를 꽉 채운다. 크기 무관하게 비율(%) 프레임.
export default function CardBack() {
  return (
    <span className="absolute inset-0 overflow-hidden rounded-[inherit] bg-white">
      <span className="pointer-events-none absolute inset-[6%] rounded-[10%] border-2 border-blue-500/25" />
      <span className="pointer-events-none absolute inset-[9%] rounded-[8%] border border-blue-500/15" />
      <span className="absolute left-1/2 top-1/2 flex h-2/5 w-2/5 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/nunopi-symbol-darkeye-transparent.png" alt="" className="h-full w-full object-contain" />
      </span>
    </span>
  );
}
