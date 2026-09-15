// 제품 모듈 경계(#878) — Mustard(워크스페이스 ADE)와 nunopi(학습 모듈, 옵션)의 분리 지점.
//
// 지금은 단일 리포/단일 앱이라 nunopi가 항상 함께 있음(true). 추후 모노레포로 쪼개면:
//   - apps/mustard: 설치 초기설정서 "nunopi 학습툴" 체크 여부 → 이 플래그(설정/빌드타임)
//   - apps/nunopi : 스탠드얼론(학습 모듈이 곧 앱) → 항상 true
//   - Mustard만(체크 해제): false → 학습 뷰·탭 UI 전부 숨김
//
// 팔레트·nav·설치 UI 등 "nunopi 표면"은 전부 이 플래그를 존중해야 함.
// ponytail: 지금은 상수. 모노레포 분리 시 앱별 빌드 플래그/런타임 설정으로 승격.
export const nunopiEnabled = true;
