"use client";

import { useState } from "react";
import DeckSelect from "./DeckSelect";
import CardSession from "./CardSession";
import type { Deck, SrsSource } from "@/lib/srs/types";

type MemPhase = "select" | "session";
type ReviewMode = "due" | "all";

// 암기 모드 최상위 뷰 — 덱 선택(③) → 카드 세션(④).
export default function MemorizeView() {
  const [phase, setPhase] = useState<MemPhase>("select");
  const [session, setSession] = useState<{ deck: Deck; sources: SrsSource[]; mode: ReviewMode } | null>(null);

  function handleStart(deck: Deck, sources: SrsSource[], mode: ReviewMode) {
    setSession({ deck, sources, mode });
    setPhase("session");
  }

  if (phase === "session" && session) {
    return <CardSession sources={session.sources} mode={session.mode} onExit={() => setPhase("select")} />;
  }

  return <DeckSelect onStart={handleStart} />;
}
