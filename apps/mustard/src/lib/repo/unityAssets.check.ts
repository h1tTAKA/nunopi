// unityAssets 점검(#1009) — 실행: node --experimental-strip-types src/lib/repo/unityAssets.check.ts
import assert from "node:assert";
import { unityGuidRefs, unityMetaGuid, unityRelation } from "./unityAssets.ts";

const G1 = "4e29b1a8efbd4b44bb3f3716e73f07ff", G2 = "fe87c0e1cc204ed48ad3b37840f39efc", P = "9de6787eaa964fe3b3a28ddf286c939c";
assert.strictEqual(unityMetaGuid(`fileFormatVersion: 2\nguid: ${G1}\nMonoImporter:\n  externalObjects: {}`), G1, "meta guid");
assert.strictEqual(unityMetaGuid("fileFormatVersion: 2\n"), null, "guid 없는 meta");

const scene = `--- !u!114 &170
MonoBehaviour:
  m_Script: {fileID: 11500000, guid: ${G1}, type: 3}
  MousePrefab: {fileID: 4410, guid: ${P}, type: 3}
--- !u!114 &214
MonoBehaviour:
  m_Script: {fileID: 11500000, guid: ${G2}, type: 3}
  m_Script2: {fileID: 11500000, guid: ${G1}, type: 3}
  m_Skybox: {fileID: 10304, guid: 0000000000000000f000000000000000, type: 0}
  m_Local: {fileID: 1988751344}
--- !u!1001 &9
PrefabInstance:
  m_SourcePrefab: {fileID: -100100000, guid: ${P}, type: 3}`;
assert.deepStrictEqual(unityGuidRefs(scene), [G1, P, G2, "0000000000000000f000000000000000"], "참조 GUID 중복 제거·등장 순(음수 fileID 포함, guid 없는 로컬 참조 제외)");

assert.strictEqual(unityRelation("Assets/Scripts/Player.cs"), "uses");
assert.strictEqual(unityRelation("Assets/Data/Balance.asset"), "uses");
assert.strictEqual(unityRelation("Assets/Prefabs/Cat.prefab"), "instantiates");
assert.strictEqual(unityRelation("Assets/Scenes/Lobby.unity"), "instantiates");
assert.strictEqual(unityRelation("Assets/Art/cat.mat"), null, "머티리얼은 연결 안 함");
console.log("unityAssets.check OK");
