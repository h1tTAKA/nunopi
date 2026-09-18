// 제품 모듈 경계(#878/#902) — Mustard(워크스페이스 ADE)와 nunopi(학습 모듈, 옵션)의 분리 지점.
//
// #902: 컴파일 상수 → 런타임 영속 플래그. 첫 실행 온보딩이 값을 정한다.
//   - Mustard-only(체크 해제): false → 학습 뷰·탭·nav·설정 섹션 전부 숨김.
//   - nunopi 켬(기본): true → 학습 모듈 표시.
//   - apps/nunopi 스탠드얼론은 이 파일을 안 씀(학습이 곧 앱).
// 팔레트·nav·홈 분기 등 "nunopi 표면"은 전부 isNunopiEnabled()를 존중해야 함.
const KEY = "mustard:nunopi-enabled";

// nunopi 학습 모듈 사용 여부. 미설정·SSR 기본 = 켜짐(true). 명시적 "false"만 끔.
export function isNunopiEnabled(): boolean {
  if (typeof window === "undefined") return true; // SSR/서버 렌더 기본
  try {
    return localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
}

// 온보딩(#902)·설정이 호출. localStorage 영속.
export function setNunopiEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "true" : "false");
  } catch {
    /* ignore */
  }
}
