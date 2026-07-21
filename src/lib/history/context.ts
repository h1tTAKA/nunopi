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

// 누노피 기능 개요 — "사용법" 질문에 근거 있게 답하도록 컨텍스트에 항상 포함.
// 상단 헤더 토글 순서(왼→오)와 동일하게 설명: 홈 → 에이전트 질문 → 코드 분석 → 글 분석 → 암기.
const APP_OVERVIEW = `# 누노피(nunopi) 사용 안내
누노피는 코드·글을 분석하며 학습하는 앱이다. 화면 상단 토글로 모드를 바꾼다(왼쪽부터 순서대로):
1. 홈: 전 기능 학습 이력을 유형별 재생목록으로 모아 보고, 이 에이전트가 그 이력을 참조해 질문에 답한다.
2. 에이전트 질문: 주제에 대해 에이전트에게 자유롭게 질문하고, 아웃풋 퀴즈(객관식/주관식)로 실력을 확인한다.
3. 코드 분석: 소스코드를 붙여넣으면 줄별 설명·토큰·개념 해설을 준다. 옆 챗룸에서 튜터에게 추가 질문하고, 나온 용어·개념은 플래시카드로 북마크한다.
4. 글 분석: 코드 대신 일반 글을 같은 방식으로 분석한다.
5. 암기: 북마크한 카드를 SRS(간격 반복)로 복습한다. 학습 통계와 활동 히트맵을 제공한다. 카드를 열면 추가 설명을 볼 수 있고, 카드 안에도 챗룸이 있어 그 카드에 대해 질문할 수 있다.

모든 질문·분석·챗은 각각 별도 세션으로 저장되며, 데이터는 서버가 아니라 사용자의 로컬 환경(브라우저)에 저장된다.`;

// 학습 이력을 날짜별 다이제스트 텍스트로 만들어 에이전트 컨텍스트(code 필드)에 넣는다.
// events는 최신순(desc) 가정. today는 "오늘"(YYYY-MM-DD) — LLM이 "어제/지난주" 상대 날짜를 스스로 해석.
export function buildHistoryContext(events: UnifiedHistoryEvent[], today: string): string {
  const guide = `${APP_OVERVIEW}\n\n사용법·기능 질문이면 위 안내로, 학습 내용·기록 질문이면 아래 이력으로 답하라. 둘 다 없는 내용은 지어내지 말 것.`;
  if (events.length === 0) return `${guide}\n\n오늘 날짜는 ${today}. 사용자의 학습 이력은 아직 없다.`;
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
  return `${guide}\n\n# 학습 이력(최신순). 오늘 날짜는 ${today}.\n${lines.join("\n")}${note}`;
}
