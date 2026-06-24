"use client";

import { useEffect, useRef, useState } from "react";
import Header from "./Header";

interface AppShellProps {
  toolbar: React.ReactNode;
  editor: React.ReactNode;
  learningPanel: React.ReactNode;
}

const SPLIT_STORAGE_KEY = "nunopi:split-left-pct";
const DEFAULT_LEFT_PCT = 70;
const MIN_LEFT_PCT = 25;
const MAX_LEFT_PCT = 75;

function clampPct(value: number): number {
  return Math.min(MAX_LEFT_PCT, Math.max(MIN_LEFT_PCT, value));
}

export default function AppShell({ toolbar, editor, learningPanel }: AppShellProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(DEFAULT_LEFT_PCT);
  // 최신 leftPct를 항상 보유 — pointerup 시 클로저 stale 없이 영속화하기 위함.
  const leftPctRef = useRef(DEFAULT_LEFT_PCT);
  const [isDesktop, setIsDesktop] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const stored = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
    if (Number.isFinite(stored) && stored >= MIN_LEFT_PCT && stored <= MAX_LEFT_PCT) {
      leftPctRef.current = stored;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeftPct(stored);
    }
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // main(max-w-7xl)이 중앙정렬이라 넓은 화면에선 양옆에 빈 거터가 생긴다.
  // 그 거터 위 wheel은 body로 가 아무것도 스크롤 안 됨 → 우측 학습패널로 넘긴다.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const panel = main.querySelector<HTMLElement>("[data-panel-scroll]");
    if (!panel) return;
    const onWheel = (e: WheelEvent) => {
      const rect = main.getBoundingClientRect();
      // main 세로 범위(에디터+패널 행) 안에서 좌우 거터에 있을 때만 → 패널로.
      const inRow = e.clientY >= rect.top && e.clientY <= rect.bottom;
      const inGutter = e.clientX < rect.left || e.clientX > rect.right;
      if (!inRow || !inGutter) return;
      panel.scrollTop += e.deltaY;
      e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // 드래그 중 텍스트 선택을 막아 끌기 경험을 깔끔하게 한다.
  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [dragging]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    const pct = clampPct(((event.clientX - rect.left) / rect.width) * 100);
    leftPctRef.current = pct;
    setLeftPct(pct);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(leftPctRef.current)));
    } catch {}
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:h-screen md:min-h-0 dark:bg-[#111219]">
      <Header />

      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#111219]">
        <div className="mx-auto w-full max-w-7xl px-6 py-3">{toolbar}</div>
      </div>

      <main
        ref={mainRef}
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:min-h-0 md:flex-row"
      >
        {/* 좌측 에디터 — Monaco가 내부 스크롤을 처리한다. */}
        <div
          style={isDesktop ? { width: `${leftPct}%` } : undefined}
          className="min-h-0 border-b border-zinc-200 md:overflow-hidden md:border-b-0 dark:border-zinc-800"
        >
          {editor}
        </div>

        {/* 드래그 핸들 — 데스크톱에서만. 좌우 폭 비율을 조절한다. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="에디터와 학습 패널 폭 조절"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`hidden w-1.5 shrink-0 cursor-col-resize border-x border-zinc-200 transition-colors md:block dark:border-zinc-800 ${
            dragging
              ? "bg-blue-400/60"
              : "bg-zinc-100 hover:bg-blue-400/40 dark:bg-zinc-900"
          }`}
        />

        {/* 우측 학습패널 — 자체 세로 스크롤. data-panel-scroll: 안쪽 박스가 wheel을 이 컨테이너로 포워딩. */}
        <aside
          data-panel-scroll
          className="nunopi-scroll bg-white md:min-h-0 md:flex-1 md:overflow-y-scroll dark:bg-[#111219]"
        >
          {learningPanel}
        </aside>
      </main>
    </div>
  );
}
