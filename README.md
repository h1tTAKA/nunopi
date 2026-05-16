# Nunopi

개발을 잘 모르는 바이브코더들을 위한 눈높이 AI 코드 학습 도구입니다.

Nunopi는 낯선 코드를 붙여넣으면 AI agent와 local rules provider가 코드를 분석하고, 초보자가 이해할 수 있도록 줄별 설명, 토큰 사전, 개념 사전 형태로 풀어주는 웹앱입니다.  
목표는 단순히 코드를 "번역"하는 것이 아니라, 사용자가 코드를 읽는 법 자체를 익히게 만드는 것입니다.

## Why

바이브코딩을 하다 보면 코드는 만들어지지만, 정작 내가 받은 코드가 무슨 뜻인지 모르는 순간이 자주 생깁니다.

Nunopi는 이런 상황을 해결하기 위해 만듭니다.

- 코드 한 줄이 무슨 일을 하는지 알고 싶을 때
- `useState`, `props`, `async`, `className` 같은 토큰의 의미를 바로 알고 싶을 때
- 에이전트가 작성한 코드를 내 눈높이로 다시 설명받고 싶을 때
- 낯선 코드베이스에서 어디부터 읽어야 할지 감을 잡고 싶을 때

## Product Direction

Nunopi는 agent-backed code learning UI를 목표로 합니다.

```txt
사용자 코드 입력
  ↓
Translator Orchestrator
  ↓
Agent Provider Adapter
  ├─ local-rules
  ├─ Claude Agent SDK / Claude Code
  ├─ Codex server
  ├─ Hermes / local LLM
  └─ OpenAI-compatible endpoint
  ↓
줄별 설명 + 토큰 사전 + 개념 사전
```

핵심 방향:

- AI agent와 local rules provider를 같은 인터페이스로 연결
- Claude, Codex, Hermes, local LLM 같은 provider를 갈아끼울 수 있는 구조
- 기존 rule-based translator는 local fallback provider로 유지
- 분석 결과는 provider와 무관하게 같은 UI로 정규화
- 코드 원문 저장은 기본 OFF
- 원격 provider 사용 시 코드 전송 가능성을 UI에 명확히 표시

## Current Status

현재는 MVP 초기 단계입니다.

- Next.js 앱 초기화 완료
- AppShell 레이아웃 완료
- translator core 타입 정의 완료
- 언어 감지 휴리스틱 구현 및 리뷰 수정 완료
- 2026-05-16 기준 agent-backed 구조로 제품 방향 전환 완료

다음 구현 단위:

```txt
Issue 005 — Agent provider 타입과 표준 응답 스키마 정의
```

## Planned Features

- 코드 입력 영역
- 줄별 코드 설명
- 코드 토큰 사전
- 개발 개념 사전
- provider 선택 UI
- local-rules fallback 분석
- Claude Agent SDK adapter PoC
- Codex agent provider PoC
- Hermes/local LLM 또는 OpenAI-compatible endpoint 연동
- 선택적 로컬 기록/북마크

## Getting Started

개발 서버 실행:

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

## Docs

프로젝트 문서는 아래 경로에 정리합니다.

```txt
/Users/hong/projects/docs/nunopi
```

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS

## Repository

```txt
https://github.com/h1tTAKA/nunopi
```
