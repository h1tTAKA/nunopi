"use client";

import { useState } from "react";
import DeckSelect from "./DeckSelect";
import CardSession from "./CardSession";
import type { Deck, SrsSource } from "@/lib/srs/types";

type MemPhase = "select" | "session";

// 암기 모드 최상위 뷰 — 덱 선택(③) → 카드 세션(④).
export default function MemorizeView() {
  const [phase, setPhase] = useState<MemPhase>("select");
  const [session, setSession] = useState<{ deck: Deck; sources: SrsSource[] } | null>(null);

  function handleStart(deck: Deck, sources: SrsSource[]) {
    setSession({ deck, sources });
    setPhase("session");
  }

  if (phase === "session" && session) {
    return <CardSession sources={session.sources} onExit={() => setPhase("select")} />;
  }

  return <DeckSelect onStart={handleStart} />;
}
