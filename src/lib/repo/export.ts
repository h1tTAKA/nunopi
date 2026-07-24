import type { RepoGraph } from "./types";
import type { RepoOverview } from "./overview";

// "레포 한눈에" 리포트 → Markdown 문자열(문서·학습정리에 붙이기 좋게).
export function overviewToMarkdown(graph: RepoGraph, overview: RepoOverview, summary?: string | null): string {
  const name = graph.root.split("/").filter(Boolean).pop() ?? graph.root;
  const out: string[] = [`# ${name} — 레포 한눈에`, "", `- 파일: ${graph.stats.files}개 · 연결: ${graph.stats.edges}개`];
  if (summary) out.push("", "## 요약", "", summary);
  out.push("", "## 덩어리 (폴더별 파일 수)", "");
  for (const g of overview.groups) out.push(`- ${g.group}: ${g.count}`);
  out.push("", "## 핵심 파일 (연결 많은 순)", "");
  for (const n of overview.godNodes) out.push(`- ${n.label} (${n.degree}) — \`${n.id}\``);
  out.push("", "## 시작점", "");
  for (const n of overview.entryPoints) out.push(`- ${n.label} — \`${n.id}\``);
  return out.join("\n") + "\n";
}

// 텍스트/데이터URL을 파일로 다운로드(브라우저·Electron 공통, <a download>).
export function downloadText(filename: string, text: string, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000); // 다운로드 시작 후 정리
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  triggerDownload(dataUrl, filename);
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
