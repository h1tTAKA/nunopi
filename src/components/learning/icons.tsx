// 학습 패널 카드/사전 공용 아이콘 — Tabler Icons 백엔드.
// 기존 export 이름(StarIcon/XIcon/BanIcon)·API(className, filled)를 유지해 호출부는 그대로.
// currentColor 상속이라 text-* 색 클래스가 그대로 먹는다.
import { IconStar, IconStarFilled, IconX, IconBan } from "@tabler/icons-react";

interface IconProps {
  className?: string;
}

// 북마크 — filled면 채운 별(북마크됨), 아니면 외곽선.
export function StarIcon({ filled, className }: IconProps & { filled?: boolean }) {
  const cls = className ?? "h-4 w-4";
  return filled ? (
    <IconStarFilled className={cls} aria-hidden />
  ) : (
    <IconStar className={cls} stroke={2} aria-hidden />
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
