"use client";

import { useT } from "@/lib/i18n/I18nProvider";

interface FlashCardProps {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
  reduced: boolean; // prefers-reduced-motion — true면 회전 애니 생략
}

// 3D 플립 카드 — 앞(용어)/뒤(용어+설명). rotateY 회전. 2안 미니멀 내용 + 1안 플립 감.
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
        {/* 앞면 — 용어 */}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center [backface-visibility:hidden] dark:border-zinc-800 dark:bg-[#15161d]">
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{front}</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{t("mem.flipHint")}</span>
        </span>
        {/* 뒷면 — 용어 + 설명 */}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)] dark:border-zinc-800 dark:bg-[#15161d]">
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{front}</span>
          <span className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {back || t("mem.noExplanation")}
          </span>
        </span>
      </button>
    </div>
  );
}
