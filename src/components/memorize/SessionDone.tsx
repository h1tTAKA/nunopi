"use client";

import { IconCircleCheck } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";

interface SessionDoneProps {
  stats: { again: number; hard: number; good: number };
  total: number; // 오늘 초기 due 수(0이면 복습할 것 없음)
  onExit: () => void;
}

// 세션 완료 화면 — 통계 + 덱으로 복귀.
export default function SessionDone({ stats, total, onExit }: SessionDoneProps) {
  const t = useT();
  const empty = total === 0;
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
      <button
        type="button"
        onClick={onExit}
        className="mt-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        {t("mem.backToDecks")}
      </button>
    </div>
  );
}
