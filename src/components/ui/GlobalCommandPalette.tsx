"use client";

// 전역 명령 팔레트 배선(#878) — ⌘K 키 바인딩 + open 상태 + 명령 조립.
// I18nProvider 안쪽에 마운트돼야 useT 가능(Home 자체는 provider 바깥이라 여기로 분리).
import { type RefObject, useEffect, useMemo, useState } from "react";
import {
  IconCode, IconFileText, IconMessage2, IconLayoutDashboard, IconCards, IconHome, IconSettings,
  IconFiles, IconFileCode, IconMessages,
} from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import CommandPalette, { type Command } from "@/components/ui/CommandPalette";
import { nunopiEnabled } from "@/lib/product";
import type { ViewMode } from "@/lib/viewMode";
import type { WorkspaceTabsHandle } from "@/components/workspace/WorkspaceTabs";
import type { AddKind } from "@/components/workspace/WorkspaceAddMenu";

// Mustard(워크스페이스 셸) 뷰 vs nunopi(학습 모듈) 뷰 — 팔레트서 섹션 분리, nunopi는 플래그로 게이트(#878).
const MUSTARD_VIEWS: ViewMode[] = ["workspace"];
const NUNOPI_VIEWS: ViewMode[] = ["code", "text", "ask", "memorize", "history"];
// 새 탭 종류 — 레포는 Mustard 네이티브(항상), 나머지는 nunopi 학습 탭(게이트).
const NUNOPI_TAB_KINDS: AddKind[] = ["ask", "code", "text", "memorize"];
// 뷰별 아이콘 — AreaModeToggle과 동일(일관성).
const VIEW_ICON: Record<ViewMode, React.ReactNode> = {
  workspace: <IconLayoutDashboard size={16} stroke={2} aria-hidden />,
  code: <IconCode size={16} stroke={2} aria-hidden />,
  text: <IconFileText size={16} stroke={2} aria-hidden />,
  ask: <IconMessage2 size={16} stroke={2} aria-hidden />,
  memorize: <IconCards size={16} stroke={2} aria-hidden />,
  history: <IconHome size={16} stroke={2} aria-hidden />,
};
// 탭 종류별 아이콘 — WorkspaceTabs 탭바(MODE_TAB)·레포(IconFiles)와 동일.
const TAB_ICON: Record<AddKind, React.ReactNode> = {
  repo: <IconFiles size={16} stroke={2} aria-hidden />,
  ask: <IconMessages size={16} stroke={2} aria-hidden />,
  code: <IconFileCode size={16} stroke={2} aria-hidden />,
  text: <IconFileText size={16} stroke={2} aria-hidden />,
  memorize: <IconCards size={16} stroke={2} aria-hidden />,
};
const NEW_TAB_KINDS: AddKind[] = ["repo", "ask", "code", "text", "memorize"];

export default function GlobalCommandPalette({
  onNavigate,
  onOpenSettings,
  vm,
  workspaceRef,
}: {
  onNavigate: (v: ViewMode) => void;
  onOpenSettings: () => void;
  vm: ViewMode;
  workspaceRef: RefObject<WorkspaceTabsHandle | null>;
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

  // open을 dep에 포함 — 팔레트 열 때 workspaceRef.listTabs()를 새로 읽어 최신 탭 목록 반영.
  const commands = useMemo<Command[]>(() => {
    // Mustard 섹션 — 워크스페이스 + 설정(항상).
    const mustard: Command[] = [
      ...MUSTARD_VIEWS.map((v) => ({ id: `view:${v}`, section: t("palette.section.mustard"), label: t(`mode.${v}`), icon: VIEW_ICON[v], run: () => onNavigate(v) })),
      { id: "settings", section: t("palette.section.mustard"), label: t("header.settings"), icon: <IconSettings size={16} stroke={2} aria-hidden />, run: onOpenSettings },
    ];
    // nunopi 학습 섹션 — 모듈 설치 시에만(스탠드얼론/설치된 경우). Mustard-only 빌드면 숨김.
    const nunopiNav: Command[] = nunopiEnabled
      ? NUNOPI_VIEWS.map((v) => ({ id: `view:${v}`, section: t("palette.section.nunopi"), label: t(`mode.${v}`), icon: VIEW_ICON[v], run: () => onNavigate(v) }))
      : [];
    const base: Command[] = [...mustard, ...nunopiNav];
    // 워크스페이스일 때만 탭 전환·생성 명령(열린 탭 목록은 ref로 즉시 조회).
    const ws = vm === "workspace" ? workspaceRef.current : null;
    if (!ws) return base;
    const switchTabs: Command[] = ws.listTabs().map((tb) => ({
      id: `tab:${tb.key}`, section: t("palette.section.tab"), label: tb.label, icon: TAB_ICON[tb.kind], run: () => ws.activate(tb.key),
    }));
    // 새 탭 — 레포(Mustard 네이티브)는 항상, nunopi 학습 탭은 게이트.
    const newKinds: AddKind[] = ["repo", ...(nunopiEnabled ? NUNOPI_TAB_KINDS : [])];
    const newTabs: Command[] = newKinds.map((k) => ({
      id: `new:${k}`, section: t("palette.section.newTab"),
      label: `${t("palette.newTab")}: ${k === "repo" ? t("palette.tabRepo") : t(`mode.${k}`)}`,
      icon: TAB_ICON[k], run: () => ws.addTab(k),
    }));
    return [...base, ...switchTabs, ...newTabs];
  }, [t, onNavigate, onOpenSettings, vm, workspaceRef, open]);

  return <CommandPalette open={open} commands={commands} onClose={() => setOpen(false)} />;
}
