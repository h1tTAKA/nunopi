"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/srs/types";
import { useFlyCard } from "./FlyCard";
import CardBack from "./CardBack";

const MAX_FAN = 14; // 시각 상한(초과해도 이만큼만 펼침)

// 덱 선택 화면 장식 — 선택 덱 카드 수만큼 부채꼴로 펼침 + 마운트/덱변경 시 펼침 애니.
// 부채꼴 장식은 빈 뒷면(CardBack)이고, 카드 클릭 시엔 실제 랜덤 북마크 카드(용어+설명)가
// 공유 FlyCardProvider를 통해 3D로 날아온다.
export default function DeckFan({ cards }: { cards: Card[] }) {
  const { throwCard, originRef } = useFlyCard();
  const [opened, setOpened] = useState(false);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reduced) { setOpened(true); return; }
    const id = window.setTimeout(() => setOpened(true), 40); // 첫 페인트 후 → 트랜지션 발동
    return () => window.clearTimeout(id);
  }, [reduced]);

  function launch(e: React.MouseEvent<HTMLSpanElement>) {
    if (cards.length === 0) return;
    const card = cards[Math.floor(Math.random() * cards.length)]; // 클릭마다 랜덤 카드 1장
    throwCard(card, e.currentTarget.getBoundingClientRect());
  }

  if (cards.length <= 0) return null;
  const n = Math.min(cards.length, MAX_FAN);
  const spread = n === 1 ? 0 : Math.min(60, 10 + n * 3.5);
  const step = n > 1 ? (spread * 2) / (n - 1) : 0;

  return (
    <div className="pt-2" ref={originRef as React.RefObject<HTMLDivElement>}>
      <div className="relative h-40 w-full" aria-hidden>
        {/* 피벗: 하단 중앙, 카드들이 위로 아치 */}
        <div className="absolute bottom-0 left-1/2 h-0 w-0">
          {Array.from({ length: n }).map((_, i) => {
            const angle = n > 1 ? -spread + step * i : 0;
            return (
              <span
                key={i}
                onClick={launch}
                className="absolute aspect-[5/7] w-36 cursor-pointer rounded-2xl border border-zinc-200 shadow-lg transition-transform hover:-translate-y-1 dark:border-zinc-700"
                style={{
                  transform: `translate(-50%, -100%) rotate(${opened ? angle : 0}deg)`,
                  transformOrigin: "bottom center",
                  transition: reduced ? undefined : `transform 520ms cubic-bezier(0.22,1,0.36,1) ${i * 35}ms`,
                  left: 0,
                  top: 0,
                }}
              >
                <CardBack />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
