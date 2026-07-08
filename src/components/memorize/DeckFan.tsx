"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CardBack from "./CardBack";

const MAX_FAN = 14; // 시각 상한(초과해도 이만큼만 펼침)

interface Fly { id: number; kf: Keyframe[] }

// 덱 선택 화면 장식 — 선택 덱 카드 수만큼 부채꼴로 펼침 + 마운트/덱변경 시 펼침 애니.
// 카드 클릭 시 3D로 날아와 가운데 부딪히고 중력으로 아래로 떨어지는 애니(Web Animations API).
export default function DeckFan({ count }: { count: number }) {
  const [opened, setOpened] = useState(false);
  const [fly, setFly] = useState<Fly | null>(null);
  const flyId = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reduced) { setOpened(true); return; }
    const id = window.setTimeout(() => setOpened(true), 40); // 첫 페인트 후 → 트랜지션 발동
    return () => window.clearTimeout(id);
  }, [reduced]);

  // fly가 세팅되면 WAAPI로 재생 → 끝나면 제거(프리즈 없음).
  useLayoutEffect(() => {
    if (!fly || !cardRef.current) return;
    const anim = cardRef.current.animate(fly.kf, { duration: 2700, fill: "forwards" });
    const done = () => setFly((f) => (f && f.id === fly.id ? null : f));
    anim.addEventListener("finish", done);
    anim.addEventListener("cancel", done);
    return () => anim.cancel();
  }, [fly]);

  function launch(e: React.MouseEvent<HTMLSpanElement>) {
    if (reduced || typeof window === "undefined") return;
    const r = e.currentTarget.getBoundingClientRect();
    // 클릭한 카드 중심 → 화면 중앙 기준 px 오프셋(그 자리에서 출발).
    const sx = r.left + r.width / 2 - window.innerWidth / 2;
    const sy = r.top + r.height / 2 - window.innerHeight / 2;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const sway = Math.random() < 0.5 ? -1 : 1;
    const spin = (Math.random() < 0.5 ? -1 : 1) * rnd(160, 460); // 날아오며 회전(패턴 랜덤)
    const s1 = rnd(60, 140), s2 = rnd(40, 100); // 바람 흔들림 폭(px)
    const fallY = window.innerHeight * 1.25; // 화면 밑으로 완전히
    // 카드 자리 → 바람에 흔들리며 곡선으로 → 가운데 부딪힘 → 살짝 들림 → 천천히 낙하 → 화면 밖.
    const kf: Keyframe[] = [
      { offset: 0, opacity: 0.35, transform: `translate3d(${sx}px,${sy}px,-120px) rotateZ(${rnd(-25, 25)}deg) scale(0.6)`, easing: "cubic-bezier(0.3,0.7,0.4,1)" },
      { offset: 0.1, opacity: 1, transform: `translate3d(${sx * 0.7 + sway * s1}px,${sy * 0.7 - s1}px,-90px) rotateY(${spin * 0.4}deg) rotateZ(${sway * 12}deg) scale(0.9)`, easing: "ease-in-out" },
      { offset: 0.26, opacity: 1, transform: `translate3d(${sx * 0.35 - sway * s2}px,${sy * 0.4 + s2 * 0.4}px,-40px) rotateY(${spin * 0.7}deg) rotateZ(${-sway * 8}deg) scale(1.5)`, easing: "ease-in-out" },
      { offset: 0.4, opacity: 1, transform: `translate3d(0,0,0) rotateX(7deg) rotateY(-11deg) rotateZ(-7deg) scale(2.95)`, easing: "cubic-bezier(0.2,0.9,0.3,1)" }, // 부딪힘
      { offset: 0.45, opacity: 1, transform: `translate3d(0,-16px,0) rotateX(7deg) rotateY(-11deg) rotateZ(-7deg) scale(2.74)` }, // 바운스
      { offset: 0.5, opacity: 1, transform: `translate3d(0,-28px,0) rotateZ(-6deg) scale(2.86)`, easing: "cubic-bezier(0.45,0.05,0.6,1)" }, // 살짝 들림 → 여기서부터 천천히 낙하
      { offset: 0.9, opacity: 1, transform: `translate3d(${sway * 24}px,${fallY * 0.72}px,0) rotateZ(${sway * 16}deg) scale(2.5)` },
      { offset: 1, opacity: 0, transform: `translate3d(${sway * 34}px,${fallY}px,0) rotateZ(${sway * 22}deg) scale(2.4)` },
    ];
    setFly({ id: ++flyId.current, kf });
  }

  if (count <= 0) return null;
  const n = Math.min(count, MAX_FAN);
  const spread = n === 1 ? 0 : Math.min(60, 10 + n * 3.5);
  const step = n > 1 ? (spread * 2) / (n - 1) : 0;

  return (
    <div className="pt-2">
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

      {/* 클릭 시 날아오는 카드(포탈, WAAPI로 재생) */}
      {fly && typeof document !== "undefined" && createPortal(
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" style={{ perspective: "1200px" }}>
          <div
            ref={cardRef}
            className="aspect-[5/7] w-36 overflow-hidden rounded-2xl border border-zinc-200 shadow-2xl dark:border-zinc-700"
            style={{ transformStyle: "preserve-3d" }}
          >
            <CardBack />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
