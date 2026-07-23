// 레포 그래프 그룹(폴더) 색 — 그래프 뷰·필터 칩 공유.
export const REPO_PALETTE = ["#3B34E2", "#0ea5e9", "#10b981", "#d946ef", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16"];
export const REPO_NODE_FALLBACK = "#71717a";

// 그룹 이름 목록 → 그룹→색 Map(팔레트 순환).
export function groupColors(groups: string[]): Map<string, string> {
  return new Map(groups.map((g, i) => [g, REPO_PALETTE[i % REPO_PALETTE.length]]));
}
