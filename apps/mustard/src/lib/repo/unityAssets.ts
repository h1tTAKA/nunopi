// Unity 에셋 구조(#1009, 에픽 #1002-2) — 씬·프리팹이 어떤 스크립트를 쓰는지는 코드가 아니라 에셋 YAML에 있다.
// 연결 고리 = GUID: 모든 에셋 옆 `<file>.meta`에 `guid: <32hex>`, 씬·프리팹 YAML은 `{fileID: N, guid: <32hex>, type: T}`로 참조.
// 순수 함수(import 없음, check 가능). YAML 파서 없이 정규식 스트림 스캔 — 수 MB 씬도 선형.

// `.meta` 본문 → 그 에셋의 GUID.
export function unityMetaGuid(metaText: string): string | null {
  return /^guid:\s*([0-9a-f]{32})\s*$/m.exec(metaText)?.[1] ?? null;
}

// 에셋 YAML 본문 → 참조한 GUID들(중복 제거, 등장 순). 레포 밖 GUID(Unity 내장·패키지)는 호출 측 사전에서 걸러짐.
export function unityGuidRefs(assetText: string): string[] {
  const out = new Set<string>();
  for (const m of assetText.matchAll(/\{\s*fileID:\s*-?\d+\s*,\s*guid:\s*([0-9a-f]{32})/g)) out.add(m[1]);
  return [...out];
}

// 참조 대상 파일 → 관계. 스크립트·데이터 에셋(ScriptableObject)은 uses, 프리팹·씬은 instantiates(배치·중첩·직렬화 필드).
// 머티리얼·텍스처 등 코드와 무관한 대상은 null(그래프 노이즈).
export function unityRelation(target: string): "uses" | "instantiates" | null {
  const t = target.toLowerCase();
  if (t.endsWith(".cs") || t.endsWith(".asset")) return "uses";
  if (t.endsWith(".prefab") || t.endsWith(".unity")) return "instantiates";
  return null;
}

export const UNITY_ASSET_EXTS = [".unity", ".prefab", ".asset"] as const;
