import { codeToHtml } from "shiki";
import type { AgentAnalyzeResponse } from "@/lib/agent";
import type { CodeToken, ConceptOccurrence } from "@/lib/translator/types";

// 분석 결과(전체 코드 + 학습패널 내용)를 폰에서도 열어 볼 수 있는
// 자체완결(self-contained) HTML 문서 문자열로 만든다.
// - shiki codeToHtml은 inline 스타일이라 CDN/JS 없이 오프라인에서도 색칠 유지
// - 사용자/모델 텍스트는 escapeHtml로 이스케이프해 문서 깨짐·XSS 방지

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shikiLang(language: string): string {
  switch (language) {
    case "react":
    case "typescript":
      return "tsx";
    case "javascript":
      return "jsx";
    case "css":
      return "css";
    case "tailwindcss":
      return "html";
    default:
      return "tsx";
  }
}

async function highlight(code: string, language: string): Promise<string> {
  try {
    return await codeToHtml(code, { lang: shikiLang(language), theme: "github-light" });
  } catch {
    // 하이라이팅 실패 시 평문 코드 블록으로 폴백
    return `<pre class="code-fallback">${escapeHtml(code)}</pre>`;
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  react_hook: "React 훅",
  state_variable: "상태 변수",
  state_setter: "상태 변경 함수",
  prop: "prop",
  function: "함수",
  event_handler: "이벤트 핸들러",
  jsx_element: "JSX 요소",
  operator: "연산자",
  keyword: "키워드",
  api_call: "API 호출",
  dependency_array: "의존성 배열",
  initial_value: "초기값",
  css_selector: "CSS 선택자",
  css_property: "CSS 속성",
  css_value: "CSS 값",
  tailwind_utility: "Tailwind 유틸",
  tailwind_layout: "Tailwind 레이아웃",
  tailwind_spacing: "Tailwind 여백",
  tailwind_color: "Tailwind 색상",
  tailwind_responsive: "Tailwind 반응형",
  tailwind_state: "Tailwind 상태",
};

function renderTokens(tokens: CodeToken[]): string {
  if (tokens.length === 0) return "";
  const cards = tokens
    .map((t) => {
      const cat = CATEGORY_LABEL[t.category] ?? escapeHtml(t.category);
      const example = t.example
        ? `<pre class="token-example">${escapeHtml(t.example)}</pre>`
        : "";
      return `<div class="card">
        <div class="token-head"><code class="token">${escapeHtml(t.token)}</code><span class="badge">${cat}</span></div>
        <div class="token-label">${escapeHtml(t.label)}</div>
        <p>${escapeHtml(t.description)}</p>
        ${example}
      </div>`;
    })
    .join("\n");
  return `<section><h2>토큰 사전</h2><div class="cards">${cards}</div></section>`;
}

function renderConcepts(concepts: ConceptOccurrence[]): string {
  if (concepts.length === 0) return "";
  const items = concepts
    .map(
      (c) =>
        `<div class="card"><div class="token-label">${escapeHtml(c.title)}</div><p class="muted">등장 줄: ${c.lines.join(", ")}</p></div>`,
    )
    .join("\n");
  return `<section><h2>개념</h2><div class="cards">${items}</div></section>`;
}

function renderLineExplanations(
  result: AgentAnalyzeResponse,
): string {
  if (result.lineExplanations.length === 0) return "";
  const items = result.lineExplanations
    .map((item) => {
      return `<div class="exp">
        <div class="exp-head"><span class="badge">${item.line}번 줄</span></div>
        <pre class="exp-code">${escapeHtml(item.code)}</pre>
        <p>${escapeHtml(item.explanation)}</p>
      </div>`;
    })
    .join("\n");
  return `<section><h2>줄별 설명</h2>${items}</section>`;
}

function renderWarnings(result: AgentAnalyzeResponse): string {
  if (result.warnings.length === 0) return "";
  const items = result.warnings
    .map((w) => `<li>[${escapeHtml(w.code)}] ${escapeHtml(w.message)}</li>`)
    .join("\n");
  return `<section><h2>경고</h2><ul class="warnings">${items}</ul></section>`;
}

function renderMeta(result: AgentAnalyzeResponse): string {
  const parts = [
    `언어: ${escapeHtml(result.language)}`,
    `provider: ${escapeHtml(result.providerId)}`,
    `생성: ${escapeHtml(new Date(result.createdAt).toLocaleString("ko-KR"))}`,
  ];
  if (result.usage?.inputTokens != null) parts.push(`입력 ${result.usage.inputTokens}토큰`);
  if (result.usage?.outputTokens != null) parts.push(`출력 ${result.usage.outputTokens}토큰`);
  return `<p class="meta">${parts.join(" · ")}</p>`;
}

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 64px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple SD Gothic Neo", sans-serif; color: #18181b; background: #fafafa; line-height: 1.6; }
  .wrap { max-width: 800px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 28px 0 12px; border-bottom: 1px solid #e4e4e7; padding-bottom: 6px; }
  .meta { color: #71717a; font-size: 0.8rem; margin: 0 0 20px; }
  .summary { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 14px 16px; }
  section { margin-top: 8px; }
  pre { overflow-x: auto; border-radius: 10px; font-size: 0.85rem; }
  pre.shiki, pre.code-fallback, pre.exp-code, pre.token-example { padding: 12px 14px; border: 1px solid #e4e4e7; background: #fff; }
  pre.code-fallback, pre.exp-code, pre.token-example { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
  .exp { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
  .exp-head { margin-bottom: 8px; }
  .badge { display: inline-block; background: #e4e4e7; color: #3f3f46; border-radius: 8px; padding: 2px 8px; font-size: 0.72rem; font-weight: 600; }
  .cards { display: grid; gap: 12px; }
  .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 12px 14px; }
  .token-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
  code.token { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f4f4f5; padding: 1px 6px; border-radius: 6px; font-size: 0.85rem; }
  .token-label { font-weight: 600; margin-bottom: 2px; }
  p { margin: 4px 0; }
  .muted { color: #71717a; font-size: 0.8rem; }
  .warnings { color: #b45309; }
  @media (min-width: 640px) { .cards { grid-template-columns: 1fr 1fr; } }
`;

export async function formatResultAsHtml(
  result: AgentAnalyzeResponse,
  code: string,
  title?: string,
): Promise<string> {
  const heading = title?.trim() ? title.trim() : "코드 분석 결과";
  const codeHtml = await highlight(code, result.language);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(heading)} — Nunopi</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<h1>${escapeHtml(heading)}</h1>
${renderMeta(result)}
<div class="summary"><strong>요약</strong><p>${escapeHtml(result.summary)}</p></div>
<section><h2>입력 코드</h2>${codeHtml}</section>
${renderLineExplanations(result)}
${renderTokens(result.tokens)}
${renderConcepts(result.concepts)}
${renderWarnings(result)}
<p class="muted" style="margin-top:32px">Nunopi — 바이브코더를 위한 AI 코드 학습 도구</p>
</div>
</body>
</html>`;
}
