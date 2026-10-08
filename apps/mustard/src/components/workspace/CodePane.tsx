"use client";
// 워크스페이스 코드칸(#647) — 파일 클릭 시 소스 읽어 shiki로 하이라이트(읽기전용). 다크 전환 대응.
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { IconLoader2, IconAlertTriangle, IconFileOff } from "@tabler/icons-react";
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
    if (bin.kind === "image" && bin.dataUrl) return (
      <div className="nunopi-scroll flex h-full flex-col items-center justify-center gap-2 overflow-auto bg-white p-3 dark:bg-[var(--s-pane)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL 미리보기라 next/image 최적화 불필요 */}
        <img src={bin.dataUrl} alt={file} className="max-h-[85%] max-w-full object-contain" />
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{file.split("/").pop()} · {fmtSize(bin.size)}</span>
      </div>
    );
    const key = bin.kind === "non-utf8" ? "code.nonUtf8" : bin.kind === "image" ? "code.imageTooBig" : "code.binary";
    return <div className="flex h-full items-center justify-center gap-1.5 text-[12px] text-zinc-400 dark:text-zinc-500"><IconFileOff size={14} stroke={2} aria-hidden /> {t(key, { size: fmtSize(bin.size) })}</div>;
  }

  return (
    <div className="nunopi-scroll h-full overflow-auto bg-white p-3 text-[12px] dark:bg-[var(--s-pane)] [&_pre]:!m-0 [&_pre]:!bg-transparent">
      {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="text-zinc-700 dark:text-zinc-200">{raw}</pre>}
    </div>
  );
}
