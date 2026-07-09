"use client";

import { useEffect, useMemo, useState } from "react";
import { IconLayoutGrid } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import DeckSelect from "./DeckSelect";
import CardSession from "./CardSession";
import MemorizeStats from "./MemorizeStats";
import DeckFan from "./DeckFan";
import { FlyCardProvider } from "./FlyCard";
import AllCardsModal from "./AllCardsModal";
import { DECK_SOURCES, type Card, type CardOrder, type Deck, type SrsSource } from "@/lib/srs/types";
import { collectCards } from "@/lib/srs/collect";
import { type CardCategory } from "@/lib/srs/due";
import type { AgentProviderKind, ProviderSettings } from "@/lib/agent";

type MemPhase = "select" | "session";
type ReviewMode = "due" | "all";

// 암기 모드 최상위 뷰 — 덱 선택(③) → 카드 세션(④). active: 헤더에서 암기 탭이 켜진 상태.
export default function MemorizeView({ active = true, providerId, providerSettings, sourceIds, onGoToSource }: { active?: boolean; providerId: AgentProviderKind; providerSettings: ProviderSettings; sourceIds: Set<string>; onGoToSource: (sourceId: string, sessionId?: string) => void }) {
  const t = useT();
  const [phase, setPhase] = useState<MemPhase>("select");
  const [showAllCards, setShowAllCards] = useState(false);
  const [autoThrowKey, setAutoThrowKey] = useState<string | undefined>(undefined);

  // 카드 "출처로 이동" — 출처 종류별 분기. analysis=분석+챗세션 복원(부모),
  // card=전체 카드 보기 열고 생성처 카드를 바로 띄운다(peek).
  function goToCardSource(card: Card) {
    if (card.sourceKind === "card" && card.originCardKey) {
      setPhase("select"); // 세션 중이면 선택 화면으로 나와 갤러리 표시
      setAutoThrowKey(card.originCardKey);
      setShowAllCards(true);
    } else if (card.sourceId) {
      // 분석발 — 다른 뷰(코드/글)로 전환만. 갤러리는 열린 채 두고(active=false로 자동 숨김),
      // 암기로 돌아오면 갤러리 그대로 복귀. (닫으면 상태 유실)
      onGoToSource(card.sourceId, card.sourceSessionId);
    }
  }
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
  // 부채꼴에 쓸 실제 카드 — 선택 덱 출처(코드덱은 세부 토글 반영). 클릭 시 이 중 랜덤 1장이 날아온다.
  const fanCards = useMemo(() => {
    const deckSources = DECK_SOURCES[deck];
    const effective = deck === "code" ? deckSources.filter((s) => codeSources.has(s)) : deckSources;
    return collectCards(effective, now);
  }, [deck, codeSources, now]);
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
    return <CardSession active={active} deck={session.deck} resume={session.resume} order={session.order} categories={session.categories} sources={session.sources} mode={session.mode} providerId={providerId} providerSettings={providerSettings} sourceIds={sourceIds} onGoToSource={goToCardSource} onExit={() => setPhase("select")} />;
  }

  // 덱 선택 — 우측 패널 + 왼쪽 학습 통계(xl+). 덱/출처를 공유해 통계가 선택 덱 따라 실시간.
  // FlyCardProvider로 감싸 DeckFan·MemorizeInsights가 같은 카드 던지기 연출을 공유.
  return (
    <FlyCardProvider active={active} providerId={providerId} providerSettings={providerSettings} sourceIds={sourceIds} onGoToSource={goToCardSource}>
    <div className="flex h-full w-full items-stretch justify-center gap-8 overflow-hidden px-8 py-6">
      {/* 왼쪽: 학습 통계 (선택 덱 실시간) — 남는 폭 전부, 상단 정렬(오른쪽 덱 패널과 top 맞춤) */}
      <div className="hidden min-h-0 flex-1 flex-col justify-start xl:flex">
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
        <div className="relative hidden min-h-0 flex-1 items-center justify-center overflow-hidden xl:flex">
          {/* 좌상단 — 전체 카드 보기 */}
          <button
            type="button"
            onClick={() => setShowAllCards(true)}
            className="absolute left-0 top-2 z-10 flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-600 backdrop-blur transition hover:border-[#3B34E2] hover:text-[#3B34E2] dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:text-[#8b86f5]"
          >
            <IconLayoutGrid size={14} stroke={2} aria-hidden />
            {t("mem.allCards")}
          </button>
          <DeckFan key={deck} cards={fanCards} />
        </div>
      </div>
    </div>
    {showAllCards && <AllCardsModal now={now} active={active} autoThrowCardKey={autoThrowKey} onClose={() => { setShowAllCards(false); setAutoThrowKey(undefined); }} />}
    </FlyCardProvider>
  );
}
