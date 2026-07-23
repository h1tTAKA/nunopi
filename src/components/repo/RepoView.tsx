"use client";

import { useEffect, useState } from "react";
import { IconSitemap, IconFolderOpen, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import RepoGraphView from "@/components/repo/RepoGraphView";
import RepoNodePanel from "@/components/repo/RepoNodePanel";
import type { RepoGraph } from "@/lib/repo/types";
import type { AgentProviderKind, ProviderSettings } from "@/lib/agent";

const REPO_PATH_KEY = "nunopi:repo-path";

// 레포 분석 모드 — 로컬 레포 폴더 → 아키텍처 그래프 + 노드 클릭 설명(부모 #585).
export default function RepoView({ active = true, providerId, providerSettings }: { active?: boolean; providerId: AgentProviderKind; providerSettings: ProviderSettings }) {
  const t = useT();
  const [path, setPath] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [graph, setGraph] = useState<RepoGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 노드별 LLM 설명 캐시(재클릭 시 재생성 X).
  const [explains, setExplains] = useState<Record<string, string>>({});
  // 마운트 후에만 window(Electron) 판별 — 서버/클라 초기 렌더 일치(하이드레이션 불일치 방지).
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 1회 플래그(SSR 안전)
  useEffect(() => setMounted(true), []);
  const desktop = mounted ? window.nunopiDesktop : undefined;

  // 새로고침 복원 — 저장된 레포 경로 있으면 자동 재분석(상태 미영속이라 재빌드).
  useEffect(() => {
    if (!mounted) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(REPO_PATH_KEY); } catch { /* ignore */ }
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 새로고침 복원용 초기 세팅
      setPath(saved);
      void analyze(saved);
    }
  }, [mounted]);

  async function analyze(target: string) {
    setAnalyzing(true);
    setGraph(null);
    setError(null);
    setSelectedId(null);
    setExplains({});
    try {
      const res = await fetch("/api/repo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: target }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "failed"); return; }
      setGraph(data as RepoGraph);
      try { localStorage.setItem(REPO_PATH_KEY, target); } catch { /* ignore */ }
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
          <div className="flex min-h-0 flex-1">
            <div className="min-h-0 min-w-0 flex-1">
              <RepoGraphView graph={graph} onNodeClick={setSelectedId} />
            </div>
            {selectedId && (
              <RepoNodePanel
                key={selectedId}
                graph={graph}
                nodeId={selectedId}
                providerId={providerId}
                providerSettings={providerSettings}
                explanation={explains[selectedId]}
                onExplained={(text) => setExplains((p) => ({ ...p, [selectedId]: text }))}
                onClose={() => setSelectedId(null)}
                onSelect={setSelectedId}
              />
            )}
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

            {!mounted ? null : desktop ? (
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
