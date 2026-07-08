"use client";

import { useEffect, useMemo, useState } from "react";
import DeckSelect from "./DeckSelect";
import CardSession from "./CardSession";
import MemorizeStats from "./MemorizeStats";
import DeckFan from "./DeckFan";
import type { CardOrder, Deck, SrsSource } from "@/lib/srs/types";
import { deckStats, type CardCategory } from "@/lib/srs/due";
import type { AgentProviderKind, ProviderSettings } from "@/lib/agent";

type MemPhase = "select" | "session";
type ReviewMode = "due" | "all";

// 암기 모드 최상위 뷰 — 덱 선택(③) → 카드 세션(④). active: 헤더에서 암기 탭이 켜진 상태.
export default function MemorizeView({ active = true, providerId, providerSettings, sourceIds, onGoToSource }: { active?: boolean; providerId: AgentProviderKind; providerSettings: ProviderSettings; sourceIds: Set<string>; onGoToSource: (sourceId: string) => void }) {
  const [phase, setPhase] = useState<MemPhase>("select");
  const [session, setSession] = useState<{ deck: Deck; sources: SrsSource[]; mode: ReviewMode; resume: boolean; order: CardOrder; categories: CardCategory[] } | null>(null);
  // 덱/세부출처는 여기서 소유 — 왼쪽 통계 패널과 오른쪽 DeckSelect가 실시간 공유(controlled).
  // typeof window 가드: 마운트 게이트로 서버엔 안 그려지지만 useState 초기화는 서버서도 실행됨.
  const [deck, setDeckRaw] = useState<Deck>(() => {
    if (typeof window === "undefined") return "code";
    const d = localStorage.getItem("nunopi:mem-deck");
    return d === "code" || d === "text" || d === "all" ? d : "code";
  });
  const [codeSources, setCodeSourcesRaw] = useState<Set<SrsSource>>(() => {
    if (typeof window === "undefined") return new Set(["token", "concept"]);
    try {
      const raw = localStorage.getItem("nunopi:mem-code-sources");
      const arr = raw ? (JSON.parse(raw) as SrsSource[]) : null;
      if (Array.isArray(arr)) return new Set(arr);
    } catch { /* ignore */ }
    return new Set(["token", "concept"]);
  });
  function setDeck(d: Deck) {
    setDeckRaw(d);
    try { localStorage.setItem("nunopi:mem-deck", d); } catch { /* ignore */ }
  }
  function setCodeSources(s: Set<SrsSource>) {
    setCodeSourcesRaw(s);
    try { localStorage.setItem("nunopi:mem-code-sources", JSON.stringify([...s])); } catch { /* ignore */ }
  }
  const now = useMemo(() => new Date(), []);
  // 항상 마운트되지만 localStorage(deckStats)를 읽으므로 서버/첫 렌더에선 비운다(하이드레이션 불일치 방지).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return null;

  function handleStart(deck: Deck, sources: SrsSource[], mode: ReviewMode, resume: boolean, order: CardOrder, categories: CardCategory[]) {
    setSession({ deck, sources, mode, resume, order, categories });
    setPhase("session");
  }

  if (phase === "session" && session) {
    return <CardSession active={active} deck={session.deck} resume={session.resume} order={session.order} categories={session.categories} sources={session.sources} mode={session.mode} providerId={providerId} providerSettings={providerSettings} sourceIds={sourceIds} onGoToSource={onGoToSource} onExit={() => setPhase("select")} />;
  }

  // 덱 선택 — 우측 패널 + 왼쪽 학습 통계(xl+). 덱/출처를 공유해 통계가 선택 덱 따라 실시간.
  return (
    <div className="flex h-full w-full items-stretch justify-center gap-8 overflow-hidden px-8 py-6">
      {/* 왼쪽: 학습 통계 (선택 덱 실시간) — 남는 폭 전부, 세로 중앙 */}
      <div className="hidden min-h-0 flex-1 flex-col justify-center xl:flex">
        <MemorizeStats deck={deck} sources={deck === "code" ? [...codeSources] : undefined} />
      </div>
      {/* 오른쪽: 덱 선택 + 부채꼴 — 왼쪽과 같은 세로 범위(h-full), 덱패널 위·부채꼴 남는공간 채움. */}
      <div className="mx-auto flex w-full max-w-lg shrink-0 flex-col xl:mx-0 xl:h-full xl:w-[30rem] xl:max-w-none">
        <DeckSelect
          deck={deck}
          onDeckChange={setDeck}
          codeSources={codeSources}
          onCodeSourcesChange={setCodeSources}
          onStart={handleStart}
        />
        {/* 덱 패널 밑 부채꼴 장식 — 남는 세로 공간 채워 중앙 배치(넓은 화면만, 넘치면 클립). */}
        <div className="hidden min-h-0 flex-1 items-center justify-center overflow-hidden xl:flex">
          <DeckFan key={deck} count={deckStats(deck, now, deck === "code" ? [...codeSources] : undefined).total} />
        </div>
      </div>
    </div>
  );
}
