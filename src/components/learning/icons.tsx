// 학습 패널 카드/사전 공용 아이콘 — Tabler Icons 백엔드.
// 기존 export 이름(StarIcon/XIcon/BanIcon)·API(className, filled)를 유지해 호출부는 그대로.
// currentColor 상속이라 text-* 색 클래스가 그대로 먹는다.
import { IconX, IconBan } from "@tabler/icons-react";

interface IconProps {
  className?: string;
}

// 로고의 라임 4각 반짝임(sparkle) 마름모 — 오목한 곡선 4점 별.
// 한 곳에서 path 정의, 색은 부모 text-lime-* 가 currentColor로 결정.
const SPARKLE_PATH = "M12 0.5 Q12.6 11.4 23.5 12 Q12.6 12.6 12 23.5 Q11.4 12.6 0.5 12 Q11.4 11.4 12 0.5 Z";

// 북마크 — filled면 채운 반짝임(북마크됨), 아니면 외곽선.
// (export명 StarIcon 유지 — 호출부 무수정.)
export function StarIcon({ filled, className }: IconProps & { filled?: boolean }) {
  const cls = className ?? "h-4 w-4";
  return (
    <svg
      viewBox="0 0 24 24"
      className={cls}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={SPARKLE_PATH} />
    </svg>
  );
}

// 삭제/닫기 — X. 코드 토큰 사전에서 카드 제거용.
export function XIcon({ className }: IconProps) {
  return <IconX className={className ?? "h-4 w-4"} stroke={2} aria-hidden />;
}

// 제외(차단) — 금지 표시.
export function BanIcon({ className }: IconProps) {
  return <IconBan className={className ?? "h-4 w-4"} stroke={2} aria-hidden />;
}
