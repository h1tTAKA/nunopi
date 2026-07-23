"use client";

import { useState } from "react";
import { IconSitemap, IconFolderOpen, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import RepoGraphView from "@/components/repo/RepoGraphView";
import type { RepoGraph } from "@/lib/repo/types";

// 레포 분석 모드 — 로컬 레포 폴더 → 아키텍처 그래프(부모 #585).
// 자식 #592: 분석 결과를 인터랙티브 그래프로 전면 렌더. 노드 클릭 정보 패널은 자식 5.
export default function RepoView({ active = true }: { active?: boolean }) {
  const t = useT();
  const [path, setPath] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [graph, setGraph] = useState<RepoGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      if (!res.canceled && res.path) { setPath(res.path); void analyze(res.path); }
    } catch { /* 무시 */ } finally {
      setPicking(false);
    }
  }

  const folderName = path ? path.split("/").filter(Boolean).pop() ?? path : null;
  const showGraph = !!graph && !analyzing;

  return (
    <div aria-hidden={!active} className="flex h-full w-full min-h-0 flex-col">
      {showGraph && graph ? (
        // ── 그래프 모드 — 상단바 + 그래프 전면 ──
        <>
          <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
            <IconSitemap size={16} stroke={2} className="shrink-0 text-[#3B34E2] dark:text-[#8b86f5]" aria-hidden />
            <span className="truncate text-[13px] font-semibold text-zinc-800 dark:text-zinc-100" title={path ?? ""}>{folderName}</span>
            <span className="shrink-0 text-[12px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {t("repo.result").replace("{files}", String(graph.stats.files)).replace("{edges}", String(graph.stats.edges))}
              {graph.stats.capped ? ` ${t("repo.capped")}` : ""}
            </span>
            <button
              type="button"
              onClick={handlePick}
              disabled={picking || analyzing}
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-[12px] font-medium text-zinc-600 transition hover:border-[#3B34E2] hover:text-[#3B34E2] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-[#8b86f5] dark:hover:text-[#8b86f5]"
            >
              <IconFolderOpen size={14} stroke={2} aria-hidden />
              {t("repo.pickAnother")}
            </button>
          </header>
          <div className="min-h-0 flex-1">
            <RepoGraphView graph={graph} />
          </div>
        </>
      ) : (
        // ── 시작/로딩/에러/웹 — 중앙 카드 ──
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
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
                    <span className="max-w-xs truncate text-[11px] text-zinc-400 dark:text-zinc-500" title={path}>{path}</span>
                    {analyzing && (
                      <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                        <IconLoader2 size={14} stroke={2} className="animate-spin" aria-hidden />
                        {t("repo.analyzing")}
                      </span>
                    )}
                    {error && !analyzing && (
                      <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-rose-500">
                        <IconAlertTriangle size={14} stroke={2} aria-hidden />
                        {t("repo.error")}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[12px] text-zinc-400 dark:text-zinc-500">{t("repo.desktopOnly")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
