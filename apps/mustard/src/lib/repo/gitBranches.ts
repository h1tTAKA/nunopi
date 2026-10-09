// 브랜치 목록 파싱(#1025) — 순수 함수(import 없음, check 가능). git-branches 라우트가 사용.
// 입력: `git for-each-ref refs/heads refs/remotes --format=%(refname)%09%(committerdate:unix)` 출력.
export interface BranchList { local: string[]; remote: string[] } // remote = 같은 이름 로컬이 없는 원격 전용("origin/x" 그대로)

export function parseBranchList(out: string): BranchList {
  const local: { name: string; at: number }[] = [];
  const remote: { name: string; at: number }[] = [];
  for (const line of out.split("\n")) {
    const [ref, ts] = line.trim().split("\t");
    if (!ref) continue;
    const at = Number(ts) || 0;
    if (ref.startsWith("refs/heads/")) local.push({ name: ref.slice("refs/heads/".length), at });
    else if (ref.startsWith("refs/remotes/")) {
      const name = ref.slice("refs/remotes/".length);
      if (name.endsWith("/HEAD")) continue; // origin/HEAD는 가리키는 별칭이지 브랜치 아님
      remote.push({ name, at });
    }
  }
  const byRecent = (a: { name: string; at: number }, b: { name: string; at: number }) => b.at - a.at || a.name.localeCompare(b.name);
  const localNames = new Set(local.map((b) => b.name));
  return {
    local: local.sort(byRecent).map((b) => b.name),
    // 원격 전용 — "origin/x"에서 리모트명 뗀 x가 로컬에 없을 때만(있으면 로컬로 고르면 됨)
    remote: remote.filter((b) => !localNames.has(b.name.slice(b.name.indexOf("/") + 1))).sort(byRecent).map((b) => b.name),
  };
}

// git ref 이름 안전 문자(영숫자 . _ / -), 선행 '-'(옵션 오해석)·'..' 차단. git이 최종 판정.
export const isSafeRef = (b: string) => /^[A-Za-z0-9._/-]+$/.test(b) && !b.startsWith("-") && !b.includes("..");

// 분리 HEAD(브랜치 아닌 커밋) 표시 라벨(#1025) — 그 커밋을 가리키는 ref가 있으면 그 이름(유저가 아는 이름: origin/develop 등),
// 없으면 짧은 해시. 원격 > 태그 > 로컬 순(분리 상태는 보통 "원격 브랜치를 그대로 체크아웃"해서 생김).
export function detachedLabel(sha: string, pointing: string[]): string {
  const refs = pointing.map((r) => r.trim()).filter((r) => r && !r.endsWith("/HEAD") && r !== "HEAD");
  const pick = refs.find((r) => r.startsWith("refs/remotes/")) ?? refs.find((r) => r.startsWith("refs/tags/")) ?? refs.find((r) => r.startsWith("refs/heads/"));
  return pick ? pick.replace(/^refs\/(remotes|tags|heads)\//, "") : sha;
}
