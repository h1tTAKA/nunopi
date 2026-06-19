"use client";

import { useRef, useState } from "react";

interface EditorChatColumnProps {
  editor: React.ReactNode;
  chat: React.ReactNode;
  chatOpen: boolean;
}

const SPLIT_KEY = "nunopi:editor-chat-top-pct";
const MIN = 25;
const MAX = 80;

// 왼쪽 컬럼을 세로 분할 — 위 에디터 / 아래 학습 챗. 챗이 닫히면 에디터 풀높이.
// 상하 드래그로 비율 조절(localStorage 보존). 우측 학습패널은 안 건드린다.
export default function EditorChatColumn({ editor, chat, chatOpen }: EditorChatColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [topPct, setTopPct] = useState(() => {
    if (typeof window === "undefined") return 55;
    const stored = Number(localStorage.getItem(SPLIT_KEY));
    return Number.isFinite(stored) && stored >= MIN && stored <= MAX ? stored : 55;
  });
  const [dragging, setDragging] = useState(false);

  if (!chatOpen) {
    return <div className="h-full">{editor}</div>;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return;
    const pct = Math.min(MAX, Math.max(MIN, ((e.clientY - rect.top) / rect.height) * 100));
    setTopPct(pct);
  }

  return (
    <div ref={ref} className="flex h-full min-h-0 flex-col">
      <div style={{ height: `${topPct}%` }} className="min-h-0 overflow-hidden">
        {editor}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="에디터와 챗 높이 조절"
        onPointerDown={(e) => {
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          setDragging(false);
          e.currentTarget.releasePointerCapture(e.pointerId);
          try { localStorage.setItem(SPLIT_KEY, String(Math.round(topPct))); } catch { /* ignore */ }
        }}
        className={`h-1.5 shrink-0 cursor-row-resize border-y border-zinc-200 transition-colors dark:border-zinc-800 ${
          dragging ? "bg-blue-400/60" : "bg-zinc-100 hover:bg-blue-400/40 dark:bg-zinc-900"
        }`}
      />
      <div className="min-h-0 flex-1 overflow-hidden">{chat}</div>
    </div>
  );
}
