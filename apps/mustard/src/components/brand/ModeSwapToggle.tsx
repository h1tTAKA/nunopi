"use client";

import { useT } from "@mustard/core";
import type { ViewMode } from "@mustard/core";
import MustardMark from "./MustardMark";
// Mustard(ADE) ↔ nunopi(학습) 제품 전환 토글(#912) — 헤더 우측 단일 브랜드 버튼.
// 워크스페이스(Mustard)일 땐 nunopi 심볼을 보여주고 누르면 학습으로, 학습(nunopi)일 땐
// Mustard 마크를 보여주고 누르면 워크스페이스로. "갈 곳의 브랜드"를 아이콘으로 표시.
// AreaPrimaryToggle(다중 아이콘)은 스탠드얼론 apps/nunopi 전용으로 유지 — 이건 Mustard 임베드 전용.
const ICON_BTN = "relative shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";

export default function ModeSwapToggle({ viewMode, onEnterNunopi, onEnterWorkspace, memorizeBadge = 0, disabled = false }: {
  viewMode: ViewMode;
  onEnterNunopi: () => void;   // 워크스페이스 → 마지막 학습뷰 복원
  onEnterWorkspace: () => void; // 학습 → 워크스페이스
  memorizeBadge?: number;       // 오늘 복습 due 수(0이면 숨김) — nunopi 심볼에 통합 표시
  disabled?: boolean;
}) {
  const t = useT();
  const inWorkspace = viewMode === "workspace";
  const onClick = inWorkspace ? onEnterNunopi : onEnterWorkspace;
  const label = t(inWorkspace ? "mode.openLearning" : "mode.workspace");
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={ICON_BTN}>
      {inWorkspace ? (
        // nunopi 심볼(블루-퍼플 그라데이션, 자체 색이라 양 테마 무관).
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/nunopi-symbol-transparent.png" alt="" className="block h-[18px] w-[18px] object-contain" />
      ) : (
        <MustardMark size={20} />
      )}
      {inWorkspace && memorizeBadge > 0 && (
        <span aria-label={`${t("mem.modeDue")} ${memorizeBadge}`}
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white">
          {memorizeBadge > 99 ? "99+" : memorizeBadge}
        </span>
      )}
    </button>
  );
}
