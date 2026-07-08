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
    const anim = cardRef.current.animate(fly.kf, {
      duration: 1550,
      easing: "cubic-bezier(0.34,1.1,0.5,1)",
      fill: "forwards",
    });
    const done = () => setFly((f) => (f && f.id === fly.id ? null : f));
    anim.addEventListener("finish", done);
    anim.addEventListener("cancel", done);
    return () => anim.cancel();
  }, [fly]);

  function launch() {
    if (reduced) return;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const side = Math.random() < 0.5 ? -1 : 1;
    const sx = side * rnd(45, 75), sy = rnd(-45, 15);
    const mx = -side * rnd(10, 32), my = rnd(-18, 18);
    const rx = rnd(-45, 45), ry = side * rnd(220, 560), rz = rnd(-70, 70);
    // 날아옴 → 가운데 부딪힘(기울어져 확대) → 살짝 들림 → 중력 낙하로 화면 밖.
    const kf: Keyframe[] = [
      { offset: 0, opacity: 0, transform: `translate3d(${sx}vw,${sy}vh,-520px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(0.35)` },
      { offset: 0.1, opacity: 1, transform: `translate3d(${sx * 0.7}vw,${sy * 0.7}vh,-460px) rotateX(${rx * 0.8}deg) rotateY(${ry * 0.8}deg) rotateZ(${rz * 0.8}deg) scale(0.5)` },
      { offset: 0.42, opacity: 1, transform: `translate3d(${mx}vw,${my}vh,-150px) rotateX(${rx / 2}deg) rotateY(${ry / 2}deg) rotateZ(${rz / 2}deg) scale(1.5)` },
      { offset: 0.58, opacity: 1, transform: `translate3d(0,0,0) rotateX(7deg) rotateY(-11deg) rotateZ(-7deg) scale(2.98)` },
      { offset: 0.64, opacity: 1, transform: `translate3d(0,-1.8vh,0) rotateX(7deg) rotateY(-11deg) rotateZ(-7deg) scale(2.76)` },
      { offset: 0.7, opacity: 1, transform: `translate3d(0,-3vh,0) rotateZ(-6deg) scale(2.86)` },
      { offset: 1, opacity: 1, transform: `translate3d(4vw,135vh,0) rotateZ(26deg) scale(2.5)` },
    ];
    setFly({ id: ++flyId.current, kf });
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
