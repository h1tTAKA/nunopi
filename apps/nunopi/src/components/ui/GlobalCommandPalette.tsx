"use client";

// 전역 명령 팔레트 배선(#878, 서브5 스탠드얼론판) — ⌘K 키 바인딩 + open 상태 + 명령 조립.
// nunopi 스탠드얼론은 학습 모듈이 곧 앱이라 워크스페이스 섹션·탭 명령이 없다(학습 뷰 + 설정만).
// I18nProvider 안쪽에 마운트돼야 useT 가능(Home 자체는 provider 바깥이라 여기로 분리).
import { useEffect, useMemo, useState } from "react";
import {
  IconCode, IconFileText, IconMessage2, IconCards, IconHome, IconSettings,
} from "@tabler/icons-react";
import { useT } from "@mustard/core";
import { CommandPalette, type Command } from "@mustard/nunopi";
import type { ViewMode } from "@mustard/core";

// 스탠드얼론 학습 뷰(워크스페이스 없음).
const NUNOPI_VIEWS: ViewMode[] = ["code", "text", "ask", "memorize", "history"];

// 뷰별 아이콘 — AreaModeToggle과 동일(일관성).
const VIEW_ICON: Partial<Record<ViewMode, React.ReactNode>> = {
  code: <IconCode size={16} stroke={2} aria-hidden />,
  text: <IconFileText size={16} stroke={2} aria-hidden />,
  ask: <IconMessage2 size={16} stroke={2} aria-hidden />,
  memorize: <IconCards size={16} stroke={2} aria-hidden />,
  history: <IconHome size={16} stroke={2} aria-hidden />,
};

export default function GlobalCommandPalette({
  onNavigate,
  onOpenSettings,
}: {
  onNavigate: (v: ViewMode) => void;
  onOpenSettings: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  // ⌘K(맥) / Ctrl+K — 전역 토글. input 포커스 중에도 열리게 preventDefault.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = NUNOPI_VIEWS.map((v) => ({
      id: `view:${v}`, section: t("palette.section.nunopi"), label: t(`mode.${v}`), icon: VIEW_ICON[v], run: () => onNavigate(v),
    }));
    return [
      ...nav,
      { id: "settings", section: t("palette.section.nunopi"), label: t("header.settings"), icon: <IconSettings size={16} stroke={2} aria-hidden />, run: onOpenSettings },
    ];
  }, [t, onNavigate, onOpenSettings]);

  return <CommandPalette open={open} commands={commands} onClose={() => setOpen(false)} />;
}
