"use client";

import { useState } from "react";
import { IconSitemap, IconFolderOpen, IconCheck, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import type { RepoGraph } from "@/lib/repo/types";

// 레포 분석 모드 — 로컬 레포 폴더 → 아키텍처 그래프 + 노드 설명/챗(부모 #585).
// 자식 #590: 폴더 선택 → /api/repo/analyze 호출 → 파일·연결 수 표시. 그래프 그림은 자식 4+.
export default function RepoView({ active = true }: { active?: boolean }) {
  const t = useT();
  const [path, setPath] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [graph, setGraph] = useState<RepoGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 데스크톱(Electron)에서만 폴더 선택 가능. 웹은 안내.
  const desktop = typeof window !== "undefined" ? window.nunopiDesktop : undefined;

  async function analyze(target: string) {
    setAnalyzing(true);
    setGraph(null);
    setError(null);
    try {
      const res = await fetch("/api/repo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: target }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "failed"); return; }
      setGraph(data as RepoGraph);
    } catch (e) {
      setError(String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handlePick() {
    if (!desktop?.pickRepoFolder || picking) return;
    setPicking(true);
    try {
      const res = await desktop.pickRepoFolder();
      if (!res.canceled && res.path) {
        setPath(res.path);
        void analyze(res.path);
      }
    } catch { /* 무시 */ } finally {
      setPicking(false);
    }
  }

  const folderName = path ? path.split("/").filter(Boolean).pop() ?? path : null;

  return (
    <div aria-hidden={!active} className="flex h-full w-full min-h-0 items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-[#3B34E2] dark:border-zinc-800 dark:bg-zinc-900 dark:text-[#8b86f5]">
          <IconSitemap size={28} stroke={2} aria-hidden />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{t("repo.title")}</h2>
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{t("repo.intro")}</p>
        </div>

        {desktop ? (
          <>
            <button
              type="button"
              onClick={handlePick}
              disabled={picking || analyzing}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3B34E2] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#322bc9] disabled:opacity-50 dark:bg-[#8b86f5] dark:text-zinc-900 dark:hover:bg-[#a5a0f8]"
            >
              <IconFolderOpen size={16} stroke={2} aria-hidden />
              {path ? t("repo.pickAnother") : t("repo.pickFolder")}
            </button>
            {path && (
              <div className="flex max-w-full flex-col items-center gap-1">
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <IconCheck size={14} stroke={2.5} aria-hidden />
                  {folderName}
                </span>
                <span className="max-w-xs truncate text-[11px] text-zinc-400 dark:text-zinc-500" title={path}>{path}</span>

                {analyzing && (
                  <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                    <IconLoader2 size={14} stroke={2} className="animate-spin" aria-hidden />
                    {t("repo.analyzing")}
                  </span>
                )}
                {error && (
                  <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-rose-500">
                    <IconAlertTriangle size={14} stroke={2} aria-hidden />
                    {t("repo.error")}
                  </span>
                )}
                {graph && !analyzing && (
                  <span className="mt-1 text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
                    {t("repo.result").replace("{files}", String(graph.stats.files)).replace("{edges}", String(graph.stats.edges))}
                    {graph.stats.capped ? ` ${t("repo.capped")}` : ""}
                  </span>
                )}
                {graph && !analyzing && (
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{t("repo.graphSoon")}</span>
                )}
              </div>
            )}
          </>
        ) : (
          // 웹(비-Electron) — 로컬 폴더 접근 불가.
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500">{t("repo.desktopOnly")}</p>
        )}
      </div>
    </div>
  );
}
