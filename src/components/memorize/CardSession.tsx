"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
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
import CardInfoPanel from "./CardInfoPanel";
import CardExplainPanel from "./CardExplainPanel";
import MemorizeChat from "./MemorizeChat";
import type { AgentProviderKind, ProviderSettings } from "@/lib/agent";

interface CardSessionProps {
  sources: SrsSource[];
  // due: 오늘 복습 대상만(에빙하우스) · all: 덱 전체 상시 복습.
  mode?: "due" | "all";
  // 암기 탭이 화면에 활성인지 — 비활성(다른 모드 보는 중)이면 키보드 무시.
  active?: boolean;
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
  onExit: () => void;
}

// toss 애니 시간(ms) — 채점 카드가 더미로 날아가는 시간.
const TOSS_MS = 320;

// toss 방향 — 각 채점 카드가 하단 중앙 3더미(좌:다시 · 중:애매 · 우:완벽)로 날아가는 transform.
const TOSS_TRANSFORM: Record<Grade, string> = {
  again: "translate(-160px, 420px) rotate(-14deg) scale(0.35)",
  hard: "translate(0px, 440px) rotate(4deg) scale(0.35)",
  good: "translate(160px, 420px) rotate(14deg) scale(0.35)",
};

// 플립 카드 세션 — 앞(용어)→3D 뒤집기→3단계 채점. "다시"는 세션 내 재복습 라운드.
// 채점 시 카드가 해당 더미로 toss되어 쌓인다.
export default function CardSession({ sources, mode = "due", active = true, providerId, providerSettings, onExit }: CardSessionProps) {
  const t = useT();
  const now = useMemo(() => new Date(), []);
  // 상시(all) 복습은 due 필터를 건너뛰고 덱 전체를 큐로.
  const initialQueue = useMemo(() => {
    const all = collectCards(sources, now);
    return mode === "all" ? all : dueCards(all, now);
  }, [sources, now, mode]);
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
  // toss 타이머 — 언마운트 시 정리(dead 컴포넌트 setState 방지).
  const tossTimer = useRef<number | null>(null);
  useEffect(() => () => { if (tossTimer.current) window.clearTimeout(tossTimer.current); }, []);

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
      tossTimer.current = window.setTimeout(() => commitGrade(g), TOSS_MS);
    },
    [flipped, tossing, reduced, commitGrade],
  );

  // 키보드 — 스페이스=뒤집기, 1/2/3=채점.
  useEffect(() => {
    if (done || !active) return; // 비활성 뷰(다른 모드 보는 중)면 키 무시
    function onKey(e: KeyboardEvent) {
      // 챗 입력 등 폼 요소에 포커스 중이면 단축키 무시(스페이스 띄어쓰기가 카드 뒤집기 안 되게).
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!tossing) setFlipped((v) => !v);
        return;
      }
      if (e.key === "1") grade("again");
      else if (e.key === "2") grade("hard");
      else if (e.key === "3") grade("good");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, active, flipped, tossing, grade]);

  if (done) {
    return <SessionDone stats={stats} total={initialQueue.length} onExit={onExit} />;
  }

  // 채점으로 카드가 소진된 만큼만 진행(뒤집기는 진행과 무관).
  const progress = round.length > 0 ? (idx / round.length) * 100 : 0;

  const gradeBar = flipped ? (
    <div className="grid grid-cols-3 gap-3">
      <GradeButton onClick={() => grade("again")} label={t("mem.again")} keyHint="1" tone="rose" disabled={!!tossing} />
      <GradeButton onClick={() => grade("hard")} label={t("mem.hard")} keyHint="2" tone="amber" disabled={!!tossing} />
      <GradeButton onClick={() => grade("good")} label={t("mem.good")} keyHint="3" tone="emerald" disabled={!!tossing} />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setFlipped(true)}
      className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {t("mem.flip")}
    </button>
  );

  return (
    <>
    {active && <MemorizeChat card={card} providerId={providerId} providerSettings={providerSettings} />}
    <div className="flex h-full w-full flex-col gap-4 px-8 py-5">
      {/* 진행률 + 덱 선택으로 돌아가기 — 스테이지는 전폭이지만 이 바는 예전 비율(중앙 max-w). */}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label={t("mem.backToDecks")}
          title={t("mem.backToDecks")}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <IconArrowLeft size={15} stroke={2} aria-hidden />
          {t("mem.backToDecks")}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {idx + 1}/{round.length}
          {roundNo > 1 && ` · ${t("mem.roundN").replace("{n}", String(roundNo))}`}
        </span>
      </div>

      {/* 스테이지 — 부채꼴(배경) 위에 카드(중앙) + 더미(우측) + 정보(우상단). */}
      <div className="relative flex flex-1 items-center justify-center">
        {/* 남은 카드 부채꼴 — 카드 뒤 배경 */}
        <CardFan remaining={round.length - idx - 1} />

        {/* 현재 카드 정보 — 우상단(넓은 화면만) */}
        <div className="absolute right-0 top-0 z-10 hidden xl:block">
          <CardInfoPanel card={card} />
        </div>

        {/* 카드 디폴트 설명 — 좌상단(넓은 화면만), 반투명으로 뒤 부채꼴 비침 */}
        <div className="absolute left-0 top-0 z-10 hidden xl:block">
          <CardExplainPanel card={card} providerId={providerId} flipped={flipped} />
        </div>

        {/* 중앙 카드 + 채점바(카드 폭 그대로). 더미만 넓게 벌린다. */}
        <div className="relative z-10 flex w-full max-w-xs flex-col items-center gap-5">
          <div
            className={`w-full ${reduced ? "" : "transition-all"}`}
            style={
              tossing && !reduced
                ? { transform: TOSS_TRANSFORM[tossing], opacity: 0, transitionDuration: `${TOSS_MS}ms` }
                : undefined
            }
          >
            <FlashCard front={card.front} back={card.back} flipped={flipped} onFlip={() => setFlipped((v) => !v)} reduced={reduced} />
          </div>
          <div className="w-full">{gradeBar}</div>
          {/* 3분류 더미 — 상단 버튼은 카드 폭 그대로, 더미만 좌우로 더 벌린다(중앙 애매 기준). */}
          <div className="mt-4 w-[26rem] max-w-[90vw]">
            <GradePiles stats={stats} landing={tossing} row />
          </div>
        </div>
      </div>
    </div>
    </>
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
