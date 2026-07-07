"use client";

import { useT } from "@/lib/i18n/I18nProvider";

interface FlashCardProps {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
  reduced: boolean; // prefers-reduced-motion — true면 회전 애니 생략
}

const SYMBOL = "/brand/nunopi-symbol-transparent.png";

// 3D 플립 카드 — 흰색 포커카드. 앞: 나노피 심볼 위 + 용어. 뒤: 좌상단 작은 심볼 + 용어 + 설명.
export default function FlashCard({ front, back, flipped, onFlip, reduced }: FlashCardProps) {
  const t = useT();
  return (
    <div className="mx-auto aspect-[5/7] w-full max-w-xs [perspective:1200px]">
      <button
        type="button"
        onClick={() => !flipped && onFlip()}
        aria-label={flipped ? back : front}
        className={`relative h-full w-full [transform-style:preserve-3d] ${
          reduced ? "" : "transition-transform duration-500"
        } ${flipped ? "[transform:rotateY(180deg)]" : ""} ${flipped ? "cursor-default" : "cursor-pointer"}`}
      >
        {/* 앞면 — 심볼 + 용어 */}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl [backface-visibility:hidden]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SYMBOL} alt="" className="h-12 w-12 object-contain [filter:brightness(0)]" />
          <span className="text-xl font-bold text-zinc-900">{front}</span>
          <span className="text-xs text-zinc-400">{t("mem.flipHint")}</span>
        </span>
        {/* 뒷면 — 좌상단 작은 심볼 + 용어 + 설명 */}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 pt-10 text-center shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SYMBOL} alt="" className="absolute left-4 top-4 h-6 w-6 object-contain opacity-70 [filter:brightness(0)]" />
          <span className="text-base font-bold text-zinc-900">{front}</span>
          <span className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
            {back || t("mem.noExplanation")}
          </span>
        </span>
      </button>
    </div>
  );
}
