// 학습 챗 — 사용자가 보고 있는 코드에 대해 자유롭게 질문하면 튜터가 한국어로 답한다.
// 응답은 JSON이 아니라 자유 텍스트라, 답을 그대로 summary에 담아 반환한다.
import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProviderKind } from "./types";
import type { TranslateWarning } from "@/lib/translator/types";

// claude --system-prompt 등에 쓰는 튜터 시스템 프롬프트(프로즈, JSON 아님).
export const CHAT_SYSTEM_PROMPT =
  "You are Nunopi, a friendly coding tutor for a Korean-speaking beginner. Answer clearly and concisely in Korean (plain text / light markdown). Do not output JSON.";

// 코드 + 대화 내역으로 챗 프롬프트를 만든다(마지막이 사용자 질문).
export function buildChatPrompt(request: AgentAnalyzeRequest): string {
  const messages = request.messages ?? [];
  const transcript = messages
    .map((m) => `${m.role === "user" ? "사용자" : "튜터"}: ${m.content}`)
    .join("\n");
  return [
    CHAT_SYSTEM_PROMPT,
    "",
    "사용자가 학습 중인 코드:",
    "```",
    request.code,
    "```",
    "",
    "대화:",
    transcript,
    "",
    "위 코드에 대한 사용자의 마지막 질문에 한국어로 답하라. 핵심만 친절하게.",
    "튜터:",
  ].join("\n");
}

// 자유 텍스트 답을 summary에 담은 응답으로 정규화.
export function normalizeChatOutput(
  rawText: string,
  providerId: AgentProviderKind,
): AgentAnalyzeResponse {
  const answer = rawText.trim();
  return chatModeResponse(providerId, answer || "(빈 응답)", []);
}

// 챗 응답 래퍼(성공 답 또는 실패/안내 메시지).
export function chatModeResponse(
  providerId: AgentProviderKind,
  summary: string,
  warnings: TranslateWarning[],
): AgentAnalyzeResponse {
  return {
    providerId,
    mode: "chat",
    language: "text",
    summary,
    lineExplanations: [],
    tokens: [],
    concepts: [],
    warnings,
    createdAt: new Date().toISOString(),
  };
}
