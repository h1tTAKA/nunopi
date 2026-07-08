"use client";

import { useEffect, useState } from "react";
import DeckSelect from "./DeckSelect";
import CardSession from "./CardSession";
import type { Deck, SrsSource } from "@/lib/srs/types";
import type { AgentProviderKind, ProviderSettings } from "@/lib/agent";

type MemPhase = "select" | "session";
type ReviewMode = "due" | "all";

// 암기 모드 최상위 뷰 — 덱 선택(③) → 카드 세션(④). active: 헤더에서 암기 탭이 켜진 상태.
export default function MemorizeView({ active = true, providerId, providerSettings }: { active?: boolean; providerId: AgentProviderKind; providerSettings: ProviderSettings }) {
  const [phase, setPhase] = useState<MemPhase>("select");
  const [session, setSession] = useState<{ deck: Deck; sources: SrsSource[]; mode: ReviewMode; resume: boolean } | null>(null);
  // 항상 마운트되지만 localStorage(deckStats)를 읽으므로 서버/첫 렌더에선 비운다(하이드레이션 불일치 방지).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return null;

  function handleStart(deck: Deck, sources: SrsSource[], mode: ReviewMode, resume: boolean) {
    setSession({ deck, sources, mode, resume });
    setPhase("session");
  }

  if (phase === "session" && session) {
    return <CardSession active={active} deck={session.deck} resume={session.resume} sources={session.sources} mode={session.mode} providerId={providerId} providerSettings={providerSettings} onExit={() => setPhase("select")} />;
  }

  return <DeckSelect onStart={handleStart} />;
}
