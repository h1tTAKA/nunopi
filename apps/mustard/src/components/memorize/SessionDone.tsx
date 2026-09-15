"use client";

import { useState } from "react";
import { IconCircleCheck, IconCheck } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Card } from "@/lib/srs/types";

interface SessionDoneProps {
  stats: { again: number; hard: number; good: number };
  total: number; // 오늘 초기 due 수(0이면 복습할 것 없음)
  againCards: Card[]; // 이번 세션 '다시'로 채점한 카드
  hardCards: Card[]; // 이번 세션 '애매'로 채점한 카드
  onRetry: (cards: Card[]) => void; // 선택 카드로 재복습
  onExit: () => void;
}

// 세션 완료 화면 — 통계 + (다시/애매 있으면) 재복습 선택 + 덱으로 복귀.
export default function SessionDone({ stats, total, againCards, hardCards, onRetry, onExit }: SessionDoneProps) {
  const t = useT();
  const empty = total === 0;
  const [pickAgain, setPickAgain] = useState(true);
  const [pickHard, setPickHard] = useState(true);
  const canRetry = againCards.length > 0 || hardCards.length > 0;
  const selected = [
    ...(pickAgain ? againCards : []),
    ...(pickHard ? hardCards : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <IconCircleCheck size={44} stroke={1.5} className="text-emerald-500" aria-hidden />
      <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
        {empty ? t("mem.noDueToday") : t("mem.doneTitle").replace("{n}", String(total))}
      </p>
      {!empty && (
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-600 dark:text-emerald-400">{t("mem.good")} {stats.good}</span>
          <span className="text-amber-600 dark:text-amber-400">{t("mem.hard")} {stats.hard}</span>
          <span className="text-rose-600 dark:text-rose-400">{t("mem.again")} {stats.again}</span>
        </div>
      )}

      {canRetry ? (
        <div className="mt-1 flex w-full flex-col items-center gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{t("mem.retryPrompt")}</p>
          {/* 재복습할 분류 선택(개수 있는 것만) */}
          <div className="flex flex-wrap justify-center gap-2">
            {againCards.length > 0 && (
              <RetryChip on={pickAgain} tone="rose" onClick={() => setPickAgain((v) => !v)} label={`${t("mem.again")} ${againCards.length}`} />
            )}
            {hardCards.length > 0 && (
              <RetryChip on={pickHard} tone="amber" onClick={() => setPickHard((v) => !v)} label={`${t("mem.hard")} ${hardCards.length}`} />
            )}
          </div>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => onRetry(selected)}
              className="rounded-xl bg-[#3B34E2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#322bc9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("mem.retryYes")}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {t("mem.retryNo")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onExit}
          className="mt-2 rounded-xl bg-[#3B34E2] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#322bc9]"
        >
          {t("mem.backToDecks")}
        </button>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  rose: "bg-rose-500 text-white",
  amber: "bg-amber-500 text-white",
};

function RetryChip({ on, tone, label, onClick }: { on: boolean; tone: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        on ? TONE[tone] : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {on && <IconCheck size={13} stroke={2.5} aria-hidden />}
      {label}
    </button>
  );
}
