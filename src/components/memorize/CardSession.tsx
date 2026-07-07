"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { collectCards } from "@/lib/srs/collect";
import { dueCards } from "@/lib/srs/due";
import { applyGrade } from "@/lib/srs/schedule";
import { updateCardState } from "@/lib/srs/store";
import type { Card, Grade, SrsSource } from "@/lib/srs/types";
import SessionDone from "./SessionDone";

interface CardSessionProps {
  sources: SrsSource[];
  onExit: () => void;
}

// 플립 카드 세션 — 앞(용어)→뒤집기→3단계 채점(다시/애매/완벽). 채점 즉시 SRS 저장.
// "다시"는 이번 세션 내 재복습 파일에 모았다가 라운드 끝에 다시 돈다(오늘 한 번 더).
export default function CardSession({ sources, onExit }: CardSessionProps) {
  const t = useT();
  // now·초기 due 큐는 마운트 시 1회 고정(세션 중 재수집 금지 — 순서 흔들림 방지).
  const now = useMemo(() => new Date(), []);
  const initialQueue = useMemo(() => dueCards(collectCards(sources, now), now), [sources, now]);

  const [round, setRound] = useState<Card[]>(initialQueue);
  const [againPile, setAgainPile] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [roundNo, setRoundNo] = useState(1);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0 });
  const [done, setDone] = useState(initialQueue.length === 0);

  const card = round[idx];

  const grade = useCallback(
    (g: Grade) => {
      if (!card) return;
      // SRS 반영 즉시 저장(세션 중단에도 진도 보존).
      updateCardState(card.key, applyGrade(card.state, g, now));
      setStats((s) => ({ ...s, [g]: s[g] + 1 }));
      const requeue = g === "again";
      const nextIdx = idx + 1;
      if (nextIdx < round.length) {
        if (requeue) setAgainPile((p) => [...p, card]);
        setIdx(nextIdx);
        setFlipped(false);
      } else {
        // 라운드 끝 — again 모은 게 있으면 다음 라운드로, 없으면 완료.
        const pile = requeue ? [...againPile, card] : againPile;
        if (pile.length > 0) {
          setRound(pile);
          setAgainPile([]);
          setIdx(0);
          setFlipped(false);
          setRoundNo((n) => n + 1);
        } else {
          setDone(true);
        }
      }
    },
    [card, idx, round.length, againPile, now],
  );

  // 키보드 — 스페이스=뒤집기, 1/2/3=채점(뒤집힌 뒤).
  useEffect(() => {
    if (done) return;
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        return;
      }
      if (!flipped) return;
      if (e.key === "1") grade("again");
      else if (e.key === "2") grade("hard");
      else if (e.key === "3") grade("good");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, flipped, grade]);

  if (done) {
    return <SessionDone stats={stats} total={initialQueue.length} onExit={onExit} />;
  }

  const progress = round.length > 0 ? ((idx + (flipped ? 0.5 : 0)) / round.length) * 100 : 0;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      {/* 진행률 */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {idx + 1}/{round.length}
          {roundNo > 1 && ` · ${t("mem.roundN").replace("{n}", String(roundNo))}`}
        </span>
      </div>

      {/* 카드 */}
      <button
        type="button"
        onClick={() => !flipped && setFlipped(true)}
        aria-label={flipped ? card.back : card.front}
        className={`flex min-h-[220px] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-[#15161d] ${
          flipped ? "cursor-default" : "cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700"
        }`}
      >
        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{card.front}</span>
        {flipped ? (
          <span className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {card.back || t("mem.noExplanation")}
          </span>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{t("mem.flipHint")}</span>
        )}
      </button>

      {/* 채점 */}
      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          <GradeButton onClick={() => grade("again")} label={t("mem.again")} keyHint="1" tone="rose" />
          <GradeButton onClick={() => grade("hard")} label={t("mem.hard")} keyHint="2" tone="amber" />
          <GradeButton onClick={() => grade("good")} label={t("mem.good")} keyHint="3" tone="emerald" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setFlipped(true)}
          className="rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {t("mem.flip")}
        </button>
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  rose: "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50",
  amber: "bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50",
  emerald: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50",
};

function GradeButton({ onClick, label, keyHint, tone }: { onClick: () => void; label: string; keyHint: string; tone: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl py-2.5 text-sm font-semibold transition ${TONES[tone]}`}
    >
      {label}
      <span className="text-[10px] opacity-60">{keyHint}</span>
    </button>
  );
}
