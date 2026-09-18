// Mustard 브랜드 심볼(#906) — 겨자 꽃가지(botanical sprig): 줄기 + 씨앗 꼬투리 2 + 십자화과 꽃 4장.
// 골드 실루엣, 배경 투명(어느 그라운드에도). 인라인 사용(온보딩·워크스페이스 시작화면·헤더).
// 꽃잎은 <use> 대신 explicit <path>+transform으로(같은 페이지 다중 인라인 시 id 충돌 회피).
export default function MustardMark({ size = 48, className }: { size?: number; className?: string }) {
  const petal = "M62 44 C55 38 54 26 62 19 C70 26 69 38 62 44 Z";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden className={className}>
      {/* 줄기 */}
      <path d="M60 92 C60 74 58 60 62 44" stroke="#a67c11" strokeWidth="4.5" strokeLinecap="round" />
      {/* 씨앗 꼬투리(silique) 좌·우 */}
      <path d="M60 70 C50 66 44 60 42 52 C52 52 58 58 60 70 Z" fill="#a67c11" />
      <path d="M61 60 C71 57 78 51 80 43 C70 43 63 49 61 60 Z" fill="#a67c11" />
      {/* 겨자꽃 — 꽃잎 4장(62,34 중심 십자) */}
      <g fill="#d4a017">
        <path d={petal} />
        <path d={petal} transform="rotate(90 62 34)" />
        <path d={petal} transform="rotate(180 62 34)" />
        <path d={petal} transform="rotate(270 62 34)" />
      </g>
      <circle cx="62" cy="34" r="6" fill="#e8b93a" />
    </svg>
  );
}
