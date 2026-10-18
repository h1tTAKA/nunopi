// @mustard/nunopi/agent — client-safe 에이전트 로직(#889). server-only providers는 @mustard/nunopi/server.
// 컴포넌트를 안 끌어옴 → 서버 라우트가 안전하게 import(메인 배럴은 client 컴포넌트 포함이라 서버서 못 씀).
export * from "./lib/agent/index";
export * from "./lib/agent/catalog";
export * from "./lib/agent/dedupe";
// #894 서브5: 에이전트 상태 서버 싱글턴(status·stream 라우트 공용) — 순수 JS, server-only 의존 없음
export * from "./lib/agentStatus";
