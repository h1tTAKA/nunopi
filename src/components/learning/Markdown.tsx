"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 챗 어시스턴트 답변을 마크다운으로 렌더(GFM 표 포함). raw HTML은 렌더하지 않아 안전.
// 스타일은 globals.css의 .nunopi-md로 스코프한다(표/코드/목록/제목/링크 등).
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="nunopi-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
