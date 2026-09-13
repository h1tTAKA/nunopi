"use client";

// 전역 명령 팔레트 배선(#878) — ⌘K 키 바인딩 + open 상태 + 명령 조립.
// I18nProvider 안쪽에 마운트돼야 useT 가능(Home 자체는 provider 바깥이라 여기로 분리).
import { useEffect, useMemo, useState } from "react";
import { IconCode, IconFileText, IconMessage2, IconLayoutDashboard, IconCards, IconHome, IconSettings } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import CommandPalette, { type Command } from "@/components/ui/CommandPalette";
import type { ViewMode } from "@/lib/viewMode";

const VIEWS: ViewMode[] = ["workspace", "code", "text", "ask", "memorize", "history"];
// 뷰별 아이콘 — AreaModeToggle과 동일(일관성).
const VIEW_ICON: Record<ViewMode, React.ReactNode> = {
  workspace: <IconLayoutDashboard size={16} stroke={2} aria-hidden />,
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
    const nav: Command[] = VIEWS.map((v) => ({
      id: `view:${v}`,
      section: t("palette.section.go"),
      label: t(`mode.${v}`),
      icon: VIEW_ICON[v],
      run: () => onNavigate(v),
    }));
    return [...nav, { id: "settings", section: t("palette.section.action"), label: t("header.settings"), icon: <IconSettings size={16} stroke={2} aria-hidden />, run: onOpenSettings }];
  }, [t, onNavigate, onOpenSettings]);

  return <CommandPalette open={open} commands={commands} onClose={() => setOpen(false)} />;
}
