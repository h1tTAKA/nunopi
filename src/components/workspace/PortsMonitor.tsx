"use client";

// 포트 패널(#880) — 하단 바 우측 아이콘 호버 시 이 워크스페이스가 띄운 dev 서버 포트 팝오버.
// UsageMonitor(#735) 미러: active일 때만 폴링(보이는 워크스페이스 1개만), 클릭 시 기본 브라우저로.
import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlugConnected, IconExternalLink } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";

const POLL_MS = 5000; // 포트는 자주 뜨고 죽음 → 사용량(분)보다 촘촘히. main이 세션 없으면 lsof 전에 [] 반환(저비용).

type Port = { port: number; pid: number; cmd: string };

export default function PortsMonitor({ path, active = true }: { path: string; active?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null); // fixed 좌표(뷰포트 클램프)
  const [ports, setPorts] = useState<Port[]>([]);
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 1회(데스크톱 API 판별은 클라에서만)
  useEffect(() => { setReady(true); }, []);

  const api = ready && typeof window !== "undefined" ? window.nunopiDesktop : undefined;

  const load = useCallback(async () => {
    const fn = window.nunopiDesktop?.ports?.list;
    if (!fn || !path) return;
    try { setPorts(await fn(path)); } catch { setPorts([]); } // IPC 실패(재시작 전 등) → 빈 목록
  }, [path]);

  // 활성 워크스페이스에서만 폴링 — 진입 1회 + POLL_MS마다(여러 탭 중복 폴링 방지).
  useEffect(() => {
    if (!active || !api?.ports) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 로드
    void load();
    const id = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [active, api, load]);

  if (ready && !api?.ports) return null; // 웹 등 미지원

  const openPopover = () => {
    setOpen(true); void load();
    const el = wrapRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 256, M = 8;
    const left = Math.max(M, Math.min(r.right - W, window.innerWidth - W - M));
    const bottom = Math.max(M, window.innerHeight - r.top + 6);
    setPos({ left, bottom });
  };

  const openPort = (p: number) => { void window.nunopiDesktop?.ports?.open(p); };

  return (
    <div ref={wrapRef} className="relative" onMouseEnter={openPopover} onMouseLeave={() => setOpen(false)}>
      <button type="button" title={t("ports.title")} aria-label={t("ports.title")}
        className="relative flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
        <IconPlugConnected size={14} stroke={2} aria-hidden />
        {ports.length > 0 ? <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[9px] font-semibold text-white">{ports.length}</span> : null}
      </button>
      {open && pos && (
        <div style={{ left: pos.left, bottom: pos.bottom }} className="fixed z-50 w-64 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-[#15161d]">
          <div className="mb-2.5 text-[12px] font-semibold text-zinc-700 dark:text-zinc-200">{t("ports.title")}</div>
          {ports.length === 0 ? (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{t("ports.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {ports.map((p) => (
                <li key={p.port}>
                  <button type="button" onClick={() => openPort(p.port)} title={t("ports.open")}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <span className="font-mono text-[12px] font-medium text-zinc-700 dark:text-zinc-200">:{p.port}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400 dark:text-zinc-500">{p.cmd}</span>
                    <IconExternalLink size={13} stroke={2} className="shrink-0 text-zinc-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
