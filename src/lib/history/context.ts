import { dayKey } from "@/lib/srs/activityLog";
import type { HistoryEventType, UnifiedHistoryEvent } from "./types";

// 이력 이벤트 유형 라벨(다이제스트용, 내부 컨텍스트라 한글 고정 — LLM이 언어 무관 처리).
const TYPE_LABEL: Record<HistoryEventType, string> = {
  analysis: "분석",
  chat: "챗",
  ask: "질문",
  quiz: "퀴즈",
  bookmark: "카드생성",
  review: "복습",
};

// 토큰 폭 관리 — 전 이력 주입 금지(마스터플랜 리스크, #527 교훈). 최근 이벤트만.
const MAX_EVENTS = 200;

// 학습 이력을 날짜별 다이제스트 텍스트로 만들어 에이전트 컨텍스트(code 필드)에 넣는다.
// events는 최신순(desc) 가정. today는 "오늘"(YYYY-MM-DD) — LLM이 "어제/지난주" 상대 날짜를 스스로 해석.
export function buildHistoryContext(events: UnifiedHistoryEvent[], today: string): string {
  if (events.length === 0) return "사용자의 학습 이력이 아직 없다.";
  const capped = events.slice(0, MAX_EVENTS);
  const lines: string[] = [];
  let curDay = "";
  for (const e of capped) {
    const d = new Date(e.createdAt);
    const k = Number.isNaN(d.getTime()) ? "?" : dayKey(d);
    if (k !== curDay) {
      curDay = k;
      lines.push(`\n## ${k}`);
    }
    const label = TYPE_LABEL[e.type] ?? e.type;
    const desc = e.description ? ` — ${e.description}` : "";
    lines.push(`- [${label}] ${e.title}${desc}`);
  }
  const note = events.length > MAX_EVENTS ? `\n\n(최근 ${MAX_EVENTS}개만 표시. 총 ${events.length}개.)` : "";
  return `아래는 사용자의 학습 이력(최신순)이다. 오늘 날짜는 ${today}. 이 이력을 근거로 사용자의 질문에 답하라. 이력에 없는 내용은 지어내지 말 것.\n${lines.join("\n")}${note}`;
}
