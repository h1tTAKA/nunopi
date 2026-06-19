// 학습 패널 카드/사전에서 공용으로 쓰는 인라인 SVG 아이콘.
// 이모지 대신 currentColor 기반 SVG로 통일해 색·크기·굵기 일관성을 맞춘다.

interface IconProps {
  className?: string;
}

// 북마크 — filled면 채운 별(북마크됨), 아니면 외곽선.
export function StarIcon({ filled, className }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4"}
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// 제외(차단) — 원 + 사선(금지). 이모지 🚫 대체.
export function BanIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4"}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}
