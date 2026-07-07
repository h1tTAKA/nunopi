"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { collectCards } from "@/lib/srs/collect";
import { dueCards } from "@/lib/srs/due";
import { applyGrade } from "@/lib/srs/schedule";
import { updateCardState } from "@/lib/srs/store";
import type { Card, Grade, SrsSource } from "@/lib/srs/types";
import SessionDone from "./SessionDone";
import FlashCard from "./FlashCard";
import CardFan from "./CardFan";
import GradePiles from "./GradePiles";

interface CardSessionProps {
  sources: SrsSource[];
  onExit: () => void;
}

// toss 애니 시간(ms) — 채점 카드가 더미로 날아가는 시간.
const TOSS_MS = 320;

// toss 방향 — 각 채점의 카드가 날아갈 transform.
const TOSS_TRANSFORM: Record<Grade, string> = {
  again: "translate(-40%, 120%) rotate(-18deg)",
  hard: "translate(60%, 120%) rotate(6deg)",
  good: "translate(120%, 60%) rotate(18deg)",
};

// 플립 카드 세션 — 앞(용어)→3D 뒤집기→3단계 채점. "다시"는 세션 내 재복습 라운드.
// 채점 시 카드가 해당 더미로 toss되어 쌓인다.
export default function CardSession({ sources, onExit }: CardSessionProps) {
  const t = useT();
  const now = useMemo(() => new Date(), []);
  const initialQueue = useMemo(() => dueCards(collectCards(sources, now), now), [sources, now]);
  // 모션 최소화 설정 — 플립/toss 애니 생략.
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const [round, setRound] = useState<Card[]>(initialQueue);
  const [againPile, setAgainPile] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [roundNo, setRoundNo] = useState(1);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0 });
  const [done, setDone] = useState(initialQueue.length === 0);
  const [tossing, setTossing] = useState<Grade | null>(null); // 진행 중 toss(연타 가드)

  const card = round[idx];

  // 실제 채점 — SRS 반영 + 라운드 전이(toss 애니 후 호출).
  const commitGrade = useCallback(
    (g: Grade) => {
      if (!card) return;
      updateCardState(card.key, applyGrade(card.state, g, now));
      setStats((s) => ({ ...s, [g]: s[g] + 1 }));
      const requeue = g === "again";
      const nextIdx = idx + 1;
      if (nextIdx < round.length) {
        if (requeue) setAgainPile((p) => [...p, card]);
        setIdx(nextIdx);
      } else {
        const pile = requeue ? [...againPile, card] : againPile;
        if (pile.length > 0) {
          setRound(pile);
          setAgainPile([]);
          setIdx(0);
          setRoundNo((n) => n + 1);
        } else {
          setDone(true);
        }
      }
      setFlipped(false);
      setTossing(null);
    },
    [card, idx, round.length, againPile, now],
  );

  // 채점 트리거 — toss 애니 재생 후 commit. reduced면 즉시.
  const grade = useCallback(
    (g: Grade) => {
      if (!flipped || tossing) return; // 뒤집힌 뒤에만, 진행 중 연타 무시
      if (reduced) {
        commitGrade(g);
        return;
      }
      setTossing(g);
      window.setTimeout(() => commitGrade(g), TOSS_MS);
    },
    [flipped, tossing, reduced, commitGrade],
  );

  // 키보드 — 스페이스=뒤집기, 1/2/3=채점.
  useEffect(() => {
    if (done) return;
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        if (!flipped && !tossing) setFlipped(true);
        return;
      }
      if (e.key === "1") grade("again");
      else if (e.key === "2") grade("hard");
      else if (e.key === "3") grade("good");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, flipped, tossing, grade]);

  if (done) {
    return <SessionDone stats={stats} total={initialQueue.length} onExit={onExit} />;
  }

  const progress = round.length > 0 ? ((idx + (flipped ? 0.5 : 0)) / round.length) * 100 : 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
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

      {/* 남은 카드 부채꼴 */}
      <CardFan remaining={round.length - idx - 1} />

      {/* 가운데 카드 + 우측 더미 */}
      <div className="flex flex-1 items-stretch gap-4">
        <div
          className={`flex-1 ${reduced ? "" : "transition-all"} `}
          style={
            tossing && !reduced
              ? { transform: TOSS_TRANSFORM[tossing], opacity: 0, transitionDuration: `${TOSS_MS}ms` }
              : undefined
          }
        >
          <FlashCard front={card.front} back={card.back} flipped={flipped} onFlip={() => setFlipped(true)} reduced={reduced} />
        </div>
        <div className="flex items-center">
          <GradePiles stats={stats} landing={tossing} />
        </div>
      </div>

      {/* 채점 / 뒤집기 */}
      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          <GradeButton onClick={() => grade("again")} label={t("mem.again")} keyHint="1" tone="rose" disabled={!!tossing} />
          <GradeButton onClick={() => grade("hard")} label={t("mem.hard")} keyHint="2" tone="amber" disabled={!!tossing} />
          <GradeButton onClick={() => grade("good")} label={t("mem.good")} keyHint="3" tone="emerald" disabled={!!tossing} />
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

function GradeButton({ onClick, label, keyHint, tone, disabled }: { onClick: () => void; label: string; keyHint: string; tone: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 ${TONES[tone]}`}
    >
      {label}
      <span className="text-[10px] opacity-60">{keyHint}</span>
    </button>
  );
}
