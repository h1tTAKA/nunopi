"use client";

import { useEffect, useRef, useState } from "react";
import Header from "./Header";
import { useT } from "@/lib/i18n/I18nProvider";

interface AppShellProps {
  editor: React.ReactNode;
  learningPanel: React.ReactNode;
  modeToggle?: React.ReactNode;
  onOpenSettings: () => void;
}

// 넓은 화면(md+): 좌(에디터)/우(학습패널) 가로 스플릿 — leftPct.
// 좁은 화면(md 미만, 화면 분할/모바일): 위(에디터)/아래(학습패널) 세로 스플릿 — topPct.
// 두 축 모두 뷰포트 고정(앱형) + 사이 핸들 드래그로 배분, 비율은 localStorage 영속.
const SPLIT_STORAGE_KEY = "nunopi:split-left-pct";
const TOP_SPLIT_STORAGE_KEY = "nunopi:split-top-pct";
const DEFAULT_LEFT_PCT = 70;
const DEFAULT_TOP_PCT = 55;
const MIN_PCT = 25;
const MAX_PCT = 75;

function clampPct(value: number): number {
  return Math.min(MAX_PCT, Math.max(MIN_PCT, value));
}

export default function AppShell({ editor, learningPanel, modeToggle, onOpenSettings }: AppShellProps) {
  const t = useT();
  const mainRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(DEFAULT_LEFT_PCT);
  const [topPct, setTopPct] = useState(DEFAULT_TOP_PCT);
  // 최신 값을 항상 보유 — pointerup 시 클로저 stale 없이 영속화하기 위함.
  const leftPctRef = useRef(DEFAULT_LEFT_PCT);
  const topPctRef = useRef(DEFAULT_TOP_PCT);
  const [isDesktop, setIsDesktop] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const storedLeft = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
    if (Number.isFinite(storedLeft) && storedLeft >= MIN_PCT && storedLeft <= MAX_PCT) {
      leftPctRef.current = storedLeft;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeftPct(storedLeft);
    }
    const storedTop = Number(localStorage.getItem(TOP_SPLIT_STORAGE_KEY));
    if (Number.isFinite(storedTop) && storedTop >= MIN_PCT && storedTop <= MAX_PCT) {
      topPctRef.current = storedTop;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTopPct(storedTop);
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
    if (isDesktop) {
      // 가로 스플릿 — X 기준 좌측 폭 %.
      if (rect.width === 0) return;
      const pct = clampPct(((event.clientX - rect.left) / rect.width) * 100);
      leftPctRef.current = pct;
      setLeftPct(pct);
    } else {
      // 세로 스플릿 — Y 기준 위쪽 높이 %.
      if (rect.height === 0) return;
      const pct = clampPct(((event.clientY - rect.top) / rect.height) * 100);
      topPctRef.current = pct;
      setTopPct(pct);
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    try {
      if (isDesktop) {
        localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(leftPctRef.current)));
      } else {
        localStorage.setItem(TOP_SPLIT_STORAGE_KEY, String(Math.round(topPctRef.current)));
      }
    } catch {}
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-white dark:bg-[#111219]">
      <Header modeToggle={modeToggle} onOpenSettings={onOpenSettings} />

      <main
        ref={mainRef}
        className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col md:flex-row"
      >
        {/* 에디터 — 넓은 화면은 좌측 폭 %, 좁은 화면은 위쪽 높이 %. Monaco가 내부 스크롤 처리. */}
        <div
          style={isDesktop ? { width: `${leftPct}%` } : { height: `${topPct}%` }}
          className="min-h-0 overflow-hidden border-zinc-200 dark:border-zinc-800"
        >
          {editor}
        </div>

        {/* 드래그 핸들 — 넓은 화면은 세로바(좌우 배분), 좁은 화면은 가로바(상하 배분). */}
        <div
          role="separator"
          aria-orientation={isDesktop ? "vertical" : "horizontal"}
          aria-label={t("layout.splitHandle")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`shrink-0 transition-colors ${
            isDesktop
              ? "w-1.5 cursor-col-resize border-x"
              : "h-1.5 cursor-row-resize border-y"
          } border-zinc-200 dark:border-zinc-800 ${
            dragging
              ? "bg-blue-400/60"
              : "bg-zinc-100 hover:bg-blue-400/40 dark:bg-zinc-900"
          }`}
        />

        {/* 학습패널 — 자체 세로 스크롤. data-panel-scroll: 안쪽 박스가 wheel을 이 컨테이너로 포워딩. */}
        <aside
          data-panel-scroll
          className="nunopi-scroll min-h-0 flex-1 overflow-y-scroll bg-white dark:bg-[#111219]"
        >
          {learningPanel}
        </aside>
      </main>
    </div>
  );
}
