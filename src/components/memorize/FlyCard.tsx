"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/I18nProvider";

const SYMBOL = "/brand/nunopi-symbol-darkeye-transparent.png";

// 날아오는 카드에 그릴 최소 내용 — 면 렌더에 앞(용어)/뒤(설명)만 필요.
export interface FlyContent {
  front: string;
  back: string;
}

interface Fly extends FlyContent {
  id: number;
  kf: Keyframe[];
}

// throwCard(content, originRect): originRect 위치에서 카드가 3D로 날아와 중앙 부딪힘→낙하.
type ThrowFn = (content: FlyContent, origin: DOMRect) => void;

const FlyCtx = createContext<ThrowFn>(() => {});
export function useFlyCard(): ThrowFn {
  return useContext(FlyCtx);
}

// 카드 던지기 애니를 화면 어디서든 공유 — 포탈 오버레이 + Web Animations API 재생을 소유.
// DeckFan(부채꼴)·MemorizeInsights(인사이트 항목)가 같은 연출을 재사용한다.
export function FlyCardProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [fly, setFly] = useState<Fly | null>(null);
  const flyId = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const throwCard = useCallback<ThrowFn>((content, r) => {
    if (reduced || typeof window === "undefined") return;
    // 클릭 요소 중심 → 화면 중앙 기준 px 오프셋(그 자리에서 출발).
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
    setFly({ id: ++flyId.current, kf, front: content.front, back: content.back });
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

  return (
    <FlyCtx.Provider value={throwCard}>
      {children}
      {fly && typeof document !== "undefined" && createPortal(
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" style={{ perspective: "1200px" }}>
          <div
            ref={cardRef}
            className="relative aspect-[5/7] w-36 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* 실제 카드 면 — 흰 포커카드(파란 이중 프레임 + 심볼 + 용어 + 설명). 확대 시 읽힌다. */}
            <span className="pointer-events-none absolute inset-[6%] rounded-[10%] border-2 border-blue-500/60" />
            <span className="pointer-events-none absolute inset-[9%] rounded-[8%] border border-blue-500/35" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3.5 py-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SYMBOL} alt="" className="h-5 w-5 shrink-0 object-contain" />
              <span className="text-[11px] font-bold leading-tight text-zinc-900">{fly.front}</span>
              <span className="line-clamp-6 whitespace-pre-wrap text-[7px] leading-snug text-zinc-600">
                {fly.back || t("mem.noExplanation")}
              </span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </FlyCtx.Provider>
  );
}
