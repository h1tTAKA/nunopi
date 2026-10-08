"use client";
// 워크스페이스 코드칸(#647) — 파일 클릭 시 소스 읽어 shiki로 하이라이트(읽기전용). 다크 전환 대응.
import { useEffect, useRef, useState } from "react";
import { codeToHtml } from "shiki";
import { IconLoader2, IconAlertTriangle, IconFileOff, IconZoomIn, IconZoomOut, IconArrowsMinimize } from "@tabler/icons-react";
import { useT } from "@mustard/core";

// 확장자 → shiki 언어. 없으면 text.
const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
  json: "json", py: "python", go: "go", rs: "rust", java: "java", kt: "kotlin", kts: "kotlin",
  rb: "ruby", php: "php", c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", cs: "csharp", swift: "swift",
  css: "css", scss: "scss", html: "html", md: "markdown", yml: "yaml", yaml: "yaml", sh: "bash", sql: "sql", toml: "toml",
};
// 바이트 → 사람이 읽는 크기(#657 미리보기 안내용).
const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
type BinaryInfo = { kind: "image" | "binary" | "non-utf8"; size: number; dataUrl?: string };

const langOf = (file: string) => EXT_LANG[file.split(".").pop()?.toLowerCase() ?? ""] ?? "text";

export default function CodePane({ root, file }: { root: string; file: string }) {
  const [html, setHtml] = useState<string>("");
  const [raw, setRaw] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [isDark, setIsDark] = useState(false);
  const [bin, setBin] = useState<BinaryInfo | null>(null); // 텍스트 아닌 파일(#657)
  const t = useT();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 파일 바뀌면 로딩 리셋(마운트/키변경 시 1회)
    setStatus("loading"); setHtml(""); setRaw(""); setBin(null);
    (async () => {
      try {
        const r = await fetch("/api/repo/file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ root, file }) });
        const d = await r.json();
        if (!r.ok) { if (!cancelled) setStatus("error"); return; }
        if (d.binary) { if (!cancelled) { setBin({ kind: d.kind, size: d.size ?? 0, dataUrl: d.dataUrl }); setStatus("ok"); } return; }
        const src: string = d.content ?? "";
        if (!cancelled) { setRaw(src); setStatus("ok"); }
      } catch { if (!cancelled) setStatus("error"); }
    })();
    return () => { cancelled = true; };
  }, [root, file]);

  // raw/테마 바뀌면 재하이라이트.
  useEffect(() => {
    if (status !== "ok" || bin) return;
    let cancelled = false;
    codeToHtml(raw, { lang: langOf(file), theme: isDark ? "github-dark" : "github-light" })
      .then((out) => { if (!cancelled) setHtml(out); })
      .catch(() => { if (!cancelled) setHtml(""); });
    return () => { cancelled = true; };
  }, [raw, file, isDark, status, bin]);

  if (status === "loading") return <div className="flex h-full items-center justify-center text-zinc-400"><IconLoader2 size={16} stroke={2} className="animate-spin" aria-hidden /></div>;
  if (status === "error") return <div className="flex h-full items-center justify-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-500"><IconAlertTriangle size={14} stroke={2} aria-hidden /> {file}</div>;

  if (bin) {
    // 이미지면 가운데 미리보기 + 파일명·크기, 그 외(바이너리·비UTF-8·큰 이미지)는 안내 한 줄.
    if (bin.kind === "image" && bin.dataUrl) return <ImageView key={file} src={bin.dataUrl} name={file.split("/").pop() ?? file} size={bin.size} />;
    const key = bin.kind === "non-utf8" ? "code.nonUtf8" : bin.kind === "image" ? "code.imageTooBig" : "code.binary";
    return <div className="flex h-full items-center justify-center gap-1.5 text-[12px] text-zinc-400 dark:text-zinc-500"><IconFileOff size={14} stroke={2} aria-hidden /> {t(key, { size: fmtSize(bin.size) })}</div>;
  }

  return (
    <div className="nunopi-scroll h-full overflow-auto bg-white p-3 text-[12px] dark:bg-[var(--s-pane)] [&_pre]:!m-0 [&_pre]:!bg-transparent">
      {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="text-zinc-700 dark:text-zinc-200">{raw}</pre>}
    </div>
  );
}

// 이미지 미리보기(#657) — 처음엔 칸에 맞춤(작은 이미지는 최대 8배까지 키움, 16px 아이콘이 점처럼 보이던 문제), +/− 버튼·⌘/Ctrl+휠(트랙패드 핀치)로 확대/축소,
// 확대 시 스크롤로 이동. 1배 초과는 픽셀 그대로(pixelated) 확대해 픽셀 아트·아이콘이 흐려지지 않게.
const ZMIN = 0.05, ZMAX = 32, ZSTEP = 1.25;
function ImageView({ src, name, size }: { src: string; name: string; size: number }) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const clamp = (z: number) => Math.min(ZMAX, Math.max(ZMIN, z));
  const fit = (w: number, h: number) => {
    const box = boxRef.current;
    if (!box || !w || !h) return 1;
    return clamp(Math.min((box.clientWidth - 24) / w, (box.clientHeight - 24) / h, 8));
  };
  // ⌘/Ctrl+휠 = 확대/축소. React onWheel은 passive라 preventDefault(페이지 줌 막기)가 안 돼 직접 등록.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clamp(e.deltaY < 0 ? z * 1.1 : z / 1.1));
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);
  const btn = "rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
  return (
    <div className="flex h-full flex-col bg-white dark:bg-[var(--s-pane)]">
      <div ref={boxRef} className="nunopi-scroll flex min-h-0 flex-1 overflow-auto p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL 미리보기라 next/image 최적화 불필요 */}
        <img src={src} alt={name} draggable={false} className="m-auto max-w-none"
          style={nat ? { width: nat.w * zoom, height: nat.h * zoom, imageRendering: zoom > 1 ? "pixelated" : "auto" } : { visibility: "hidden" }}
          onLoad={(e) => { const w = e.currentTarget.naturalWidth, h = e.currentTarget.naturalHeight; setNat({ w, h }); setZoom(fit(w, h)); }} />
      </div>
      <div className="flex shrink-0 items-center justify-center gap-1 border-t border-zinc-200 px-2 py-1 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        <span className="mr-2 truncate">{name}{nat ? ` · ${nat.w}×${nat.h}` : ""} · {fmtSize(size)}</span>
        <button type="button" className={btn} onClick={() => setZoom((z) => clamp(z / ZSTEP))} title={t("code.zoomOut")} aria-label={t("code.zoomOut")}><IconZoomOut size={14} stroke={2} /></button>
        <span className="w-11 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" className={btn} onClick={() => setZoom((z) => clamp(z * ZSTEP))} title={t("code.zoomIn")} aria-label={t("code.zoomIn")}><IconZoomIn size={14} stroke={2} /></button>
        <button type="button" className={btn} onClick={() => nat && setZoom(fit(nat.w, nat.h))} title={t("code.zoomFit")} aria-label={t("code.zoomFit")}><IconArrowsMinimize size={14} stroke={2} /></button>
      </div>
    </div>
  );
}
