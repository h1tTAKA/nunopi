"use client";

import { useId } from "react";
// Mustard 브랜드 심볼(#906, #912 리디자인) — 겨자 꽃송이(raceme): 얇은 골드 곡선 줄기+잎 위로
// 십자화과 꽃(둥근 4잎) 여럿이 응집 돔을 이루고 꼭대기에 봉오리 하나. 골드 그라데이션으로 우아하게.
const PETAL = "M0 9 C-7 3 -8 -9 0 -15 C8 -9 7 3 0 9 Z"; // 원점 중심서 위로 뻗는 통통한 꽃잎(별표 방지)
const FLORETS = [ // 개화 꽃 위치·크기 — 응집 돔
  { x: 60, y: 34, s: 0.55 }, { x: 49, y: 46, s: 0.5 }, { x: 71, y: 46, s: 0.5 }, { x: 60, y: 54, s: 0.6 },
];

function Floret({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g fill={fill}>
        <path d={PETAL} />
        <path d={PETAL} transform="rotate(90)" />
        <path d={PETAL} transform="rotate(180)" />
        <path d={PETAL} transform="rotate(270)" />
      </g>
      <circle cx="0" cy="0" r="4.5" fill="#f0c445" />
    </g>
  );
}

export default function MustardMark({ size = 48, className }: { size?: number; className?: string }) {
  // 그라데이션 id는 인스턴스마다 유니크 — 같은 페이지에 마크 여럿 인라인 시 id 충돌 방지.
  const gid = useId();
  const fill = `url(#${gid})`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0c445" />
          <stop offset="1" stopColor="#c8960f" />
        </linearGradient>
      </defs>
      {/* 마크 전체 살짝 확대(비율 유지) + 캔버스 중앙 재정렬 — 작은 크기 가시성. */}
      <g transform="translate(-7.2 -14.5) scale(1.12)">
        {/* 줄기 */}
        <path d="M60 108 C60 92 56 82 60 70" fill="none" stroke="#b7860f" strokeWidth="3" strokeLinecap="round" />
        {/* 잎 우·좌(스태거) */}
        <path d="M59 92 C67 90 73 84 75 76 C66 76 60 82 59 92 Z" fill="#b7860f" />
        <path d="M61 98 C53 96 47 90 45 82 C54 82 60 88 61 98 Z" fill="#b7860f" />
        {/* 꽃송이 */}
        {FLORETS.map((f, i) => <Floret key={i} {...f} fill={fill} />)}
      </g>
    </svg>
  );
}
