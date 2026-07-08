"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CardBack from "./CardBack";

const MAX_FAN = 14; // 시각 상한(초과해도 이만큼만 펼침)

interface Fly { x: number; y: number; w: number; h: number }

// 덱 선택 화면 장식 — 선택 덱 카드 수만큼 부채꼴로 펼침 + 마운트/덱변경 시 펼침 애니.
// 카드 클릭 시 그 위치에서 화면 한가운데로 확대되며 날아오는 오버레이 애니(포탈).
// key={deck}로 리마운트해 덱 바꿀 때마다 다시 펼쳐진다.
export default function DeckFan({ count }: { count: number }) {
  const [opened, setOpened] = useState(false);
  const [fly, setFly] = useState<Fly | null>(null);
  const [phase, setPhase] = useState<"start" | "center" | "gone">("start");
  const timers = useRef<number[]>([]);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reduced) { setOpened(true); return; }
    const id = window.setTimeout(() => setOpened(true), 40); // 첫 페인트 후 → 트랜지션 발동
    return () => window.clearTimeout(id);
  }, [reduced]);

  // 언마운트 시 진행 중 타이머 정리.
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);

  function launch(e: React.MouseEvent<HTMLSpanElement>) {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setFly({ x: r.left, y: r.top, w: r.width, h: r.height });
    setPhase("start");
    // 다음 프레임에 중앙으로 트랜지션 발동 → 잠깐 머문 뒤 사라짐.
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase("center")));
    timers.current.push(window.setTimeout(() => setPhase("gone"), 750));
    timers.current.push(window.setTimeout(() => setFly(null), 1080));
  }

  if (count <= 0) return null;
  const n = Math.min(count, MAX_FAN);
  const spread = n === 1 ? 0 : Math.min(60, 10 + n * 3.5);
  const step = n > 1 ? (spread * 2) / (n - 1) : 0;

  return (
    <div className="pt-5">
      <div className="relative h-52 w-full" aria-hidden>
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

      {/* 클릭 시 화면 중앙으로 날아오는 카드(포탈) */}
      {fly && typeof document !== "undefined" && createPortal(
        <div className="pointer-events-none fixed inset-0 z-50">
          <div
            className="absolute aspect-[5/7] overflow-hidden rounded-2xl border border-zinc-200 shadow-2xl dark:border-zinc-700"
            style={{
              left: phase === "start" ? fly.x : "50%",
              top: phase === "start" ? fly.y : "50%",
              width: fly.w,
              height: fly.h,
              transform:
                phase === "start"
                  ? "translate(0,0) scale(1)"
                  : phase === "center"
                    ? "translate(-50%,-50%) scale(2.8)"
                    : "translate(-50%,-50%) scale(3)",
              opacity: phase === "gone" ? 0 : 1,
              transition: "left 620ms cubic-bezier(0.16,1,0.3,1), top 620ms cubic-bezier(0.16,1,0.3,1), transform 620ms cubic-bezier(0.16,1,0.3,1), opacity 320ms ease",
            }}
          >
            <CardBack />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
