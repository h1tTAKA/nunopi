import type { ViewMode } from "@/lib/viewMode";

// 전역 학습 히스토리 — 여러 저장소의 활동을 하나의 통일 이벤트로(#558).
export type HistoryEventType = "analysis" | "chat" | "ask" | "quiz" | "bookmark" | "review";

export interface HistoryNav {
  mode: ViewMode;
  sourceId?: string;   // 분석 히스토리 항목 id
  sessionId?: string;  // 질문/분석 챗 세션 id
  subId?: string;      // 질문(서브) id
  quizId?: string;     // 퀴즈 세션 id(질문모드 퀴즈 탭 열기)
  cardKey?: string;    // 카드(암기) key
}

export interface UnifiedHistoryEvent {
  type: HistoryEventType;
  id: string;          // 이벤트 고유(대개 원본 id)
  createdAt: string;   // ISO — 타임라인 정렬 키
  title: string;
  description?: string;
  nav?: HistoryNav;    // 클릭 시 이동(자식 #4에서 배선)
}
