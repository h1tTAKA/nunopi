// 증분 재조정 — 이전 캐시 + 현재 파일(mtime) 목록으로 재사용/재파싱 결정.
// fs·그래프 의존 없는 순수 로직(테스트 쉬움). read+parse는 extract 콜백이 변경 파일만 수행.

export interface FileEntry {
  mtimeMs: number;   // 파일 수정시각(변경 판별 키)
  specs: string[];   // 그 파일서 추출한 import 지정자(재사용 대상)
}
export type FileCache = Map<string, FileEntry>; // rel 경로 → 엔트리

// prev 캐시와 현재 파일 목록 비교:
//   mtime 같음 → specs 재사용(extract 호출 X)
//   다름·신규 → extract(rel) 호출해 재파싱
//   삭제된 파일 → 새 캐시에 없음(현재 목록 기준 재구성이라 자동 드롭)
export function reconcile(
  prev: FileCache,
  files: { rel: string; mtimeMs: number }[],
  extract: (rel: string) => string[],
): { cache: FileCache; reparsed: number } {
  const cache: FileCache = new Map();
  let reparsed = 0;
  for (const { rel, mtimeMs } of files) {
    const cached = prev.get(rel);
    if (cached && cached.mtimeMs === mtimeMs) {
      cache.set(rel, cached);               // 재사용
    } else {
      cache.set(rel, { mtimeMs, specs: extract(rel) }); // 재파싱
      reparsed++;
    }
  }
  return { cache, reparsed };
}
