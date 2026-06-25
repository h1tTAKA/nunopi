import { codeToHtml } from "shiki";
import type { AgentAnalyzeResponse } from "@/lib/agent";
import type { CodeToken, ConceptOccurrence, ItConcept, ItTerm } from "@/lib/translator/types";
import { reanchorLineNumbers, remapLines } from "@/lib/reanchorLines";

// 화면과 동일한 번역 함수(useT 반환 타입)를 인자로 받아 HTML도 선택 언어로 출력한다.
type TFn = (key: string, vars?: Record<string, string | number>) => string;

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

function renderTokens(tokens: CodeToken[], t: TFn): string {
  if (tokens.length === 0) return "";
  const cards = tokens
    .map((tok) => {
      const cat = escapeHtml(t(`cat.${tok.category}`));
      const example = tok.example
        ? `<pre class="token-example">${escapeHtml(tok.example)}</pre>`
        : "";
      return `<div class="card">
        <div class="token-head"><code class="token">${escapeHtml(tok.token)}</code><span class="badge">${cat}</span></div>
        <div class="token-label">${escapeHtml(tok.label)}</div>
        <p>${escapeHtml(tok.description)}</p>
        ${example}
      </div>`;
    })
    .join("\n");
  return `<section><h2>${escapeHtml(t("export.tokenDict"))}</h2><div class="cards">${cards}</div></section>`;
}

function renderConcepts(concepts: ConceptOccurrence[], t: TFn): string {
  if (concepts.length === 0) return "";
  const items = concepts
    .map((c) => {
      const desc = c.description ? `<p>${escapeHtml(c.description)}</p>` : "";
      const cLines = c.lines ?? [];
      const lines = cLines.length > 0 ? `<p class="muted">${escapeHtml(t("export.appearLines", { lines: cLines.join(", ") }))}</p>` : "";
      return `<div class="card"><div class="token-label">${escapeHtml(c.title)}</div>${desc}${lines}</div>`;
    })
    .join("\n");
  return `<section><h2>${escapeHtml(t("export.concepts"))}</h2><div class="cards">${items}</div></section>`;
}

// 글(text) 모드 — IT 용어 사전. 화면 ItTermSection에 대응.
function renderTerms(terms: ItTerm[], t: TFn): string {
  if (terms.length === 0) return "";
  const cards = terms
    .map((term) => {
      const reading = term.reading
        ? `<span class="badge">${escapeHtml(term.reading)}</span>`
        : "";
      return `<div class="card">
        <div class="token-head"><code class="token">${escapeHtml(term.term)}</code>${reading}</div>
        <p>${escapeHtml(term.explanation)}</p>
      </div>`;
    })
    .join("\n");
  return `<section><h2>${escapeHtml(t("export.termDict"))}</h2><div class="cards">${cards}</div></section>`;
}

// 글(text) 모드 — 관련 개념. 화면 ItConceptSection에 대응.
function renderItConcepts(concepts: ItConcept[], t: TFn): string {
  if (concepts.length === 0) return "";
  const cards = concepts
    .map((c) => {
      return `<div class="card"><div class="token-label">${escapeHtml(c.title)}</div><p>${escapeHtml(c.explanation)}</p></div>`;
    })
    .join("\n");
  return `<section><h2>${escapeHtml(t("export.relatedConcepts"))}</h2><div class="cards">${cards}</div></section>`;
}

function renderLineExplanations(
  result: AgentAnalyzeResponse,
  t: TFn,
): string {
  if (result.lineExplanations.length === 0) return "";
  const items = result.lineExplanations
    .map((item) => {
      return `<div class="exp">
        <div class="exp-head"><span class="badge">${escapeHtml(t("panel.lineN", { n: item.line }))}</span></div>
        <pre class="exp-code">${escapeHtml(item.code)}</pre>
        <p>${escapeHtml(item.explanation)}</p>
      </div>`;
    })
    .join("\n");
  return `<section><h2>${escapeHtml(t("export.lineExplanations"))}</h2>${items}</section>`;
}

function renderWarnings(result: AgentAnalyzeResponse, t: TFn): string {
  if (result.warnings.length === 0) return "";
  const items = result.warnings
    .map((w) => `<li>[${escapeHtml(w.code)}] ${escapeHtml(w.message)}</li>`)
    .join("\n");
  return `<section><h2>${escapeHtml(t("export.warnings"))}</h2><ul class="warnings">${items}</ul></section>`;
}

function renderMeta(result: AgentAnalyzeResponse, t: TFn, dateLocale: string): string {
  const parts = [
    `${t("export.metaLanguage")}: ${escapeHtml(result.language)}`,
    `provider: ${escapeHtml(result.providerId)}`,
    `${t("export.metaCreated")}: ${escapeHtml(new Date(result.createdAt).toLocaleString(dateLocale))}`,
  ];
  if (result.usage?.inputTokens != null) parts.push(escapeHtml(t("panel.tokensInput", { n: result.usage.inputTokens })));
  if (result.usage?.outputTokens != null) parts.push(escapeHtml(t("panel.tokensOutput", { n: result.usage.outputTokens })));
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
  title: string | undefined,
  t: TFn,
  dateLocale: string,
): Promise<string> {
  const lang = dateLocale.split("-")[0];
  const isText = result.mode === "text";
  const heading = title?.trim()
    ? title.trim()
    : isText
      ? t("export.headingText")
      : t("export.headingCode");

  // 글 모드: 산문이라 shiki·줄번호 재앵커 불필요. 평문 블록으로 입력 글을 보존한다.
  // 코드 모드: 입력 코드 shiki 하이라이팅 + LLM 줄번호를 실제 행에 재앵커(토큰/개념 lines도 보정).
  let inputSection: string;
  let bodySections: string;
  let anchored: AgentAnalyzeResponse = result;
  if (isText) {
    inputSection = `<section><h2>${escapeHtml(t("export.inputText"))}</h2><pre class="code-fallback">${escapeHtml(code)}</pre></section>`;
    bodySections = `${renderTerms(result.terms ?? [], t)}\n${renderItConcepts(result.itConcepts ?? [], t)}`;
  } else {
    const codeHtml = await highlight(code, result.language);
    const { lineExplanations, lineMap } = reanchorLineNumbers(code, result.lineExplanations);
    anchored = {
      ...result,
      lineExplanations,
      tokens: result.tokens.map((t) => ({ ...t, lines: remapLines(t.lines, lineMap) })),
      concepts: result.concepts.map((c) => ({ ...c, lines: remapLines(c.lines ?? [], lineMap) })),
    };
    inputSection = `<section><h2>${escapeHtml(t("export.inputCode"))}</h2>${codeHtml}</section>`;
    bodySections = `${renderLineExplanations(anchored, t)}
${renderTokens(anchored.tokens, t)}
${renderConcepts(anchored.concepts, t)}`;
  }

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(heading)} — Nunopi</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<h1>${escapeHtml(heading)}</h1>
${renderMeta(anchored, t, dateLocale)}
<div class="summary"><strong>${escapeHtml(t("export.summary"))}</strong><p>${escapeHtml(anchored.summary)}</p></div>
${inputSection}
${bodySections}
${renderWarnings(anchored, t)}
<p class="muted" style="margin-top:32px">${escapeHtml(t("export.footer"))}</p>
</div>
</body>
</html>`;
}
