// typeRefs 점검(#1005) — 실행: node --experimental-strip-types src/lib/repo/typeRefs.check.ts
import assert from "node:assert";
import { csharpNamespaces, csharpTypeRefs, isEngineStub, stripCsharp, type TypeDef } from "./typeRefs.ts";

const defs: TypeDef[] = [
  { name: "EntityView", file: "Assets/Scripts/View/EntityView.cs", namespace: "NyanDash.EntityView" },
  { name: "Spawner", file: "Assets/Scripts/Gameplay/Spawner.cs", namespace: "NyanDash.Gameplay" },
  { name: "Config", file: "Assets/Scripts/Gameplay/Config.cs", namespace: "NyanDash.Gameplay" },
  { name: "Config", file: "Assets/Scripts/Shop/Config.cs", namespace: "NyanDash.Shop" },
  { name: "Player", file: "Assets/Scripts/Gameplay/Player.cs", namespace: "NyanDash.Gameplay" },
];
const index = new Map<string, TypeDef[]>();
for (const d of defs) index.set(d.name, [...(index.get(d.name) ?? []), d]);

const src = `using UnityEngine;
using NyanDash.EntityView;
namespace NyanDash.Gameplay {
  // Player is mentioned only in a comment
  public class Spawner : MonoBehaviour {
    [SerializeField] EntityView prefab;
    Config cfg;                 // 같은 이름 2개 → 같은 네임스페이스(Gameplay) 쪽
    string s = "Player";        // 문자열 안 → 참조 아님
    void Spawn() { var v = Instantiate(prefab); }
  }
}`;
const refs = csharpTypeRefs("Assets/Scripts/Gameplay/Spawner.cs", src, index).sort();
assert.deepStrictEqual(refs, ["Assets/Scripts/Gameplay/Config.cs", "Assets/Scripts/View/EntityView.cs"], "using 타입 + 같은 ns 우선, 주석·문자열·자기 파일·외부 타입 제외");
assert.deepStrictEqual(csharpNamespaces("namespace A.B;\nusing X.Y;\nusing Z = Q.R;").declared, "A.B", "파일 범위 namespace");
assert.ok(!stripCsharp('var s = @"a ""Player"" b";').includes("Player"), "verbatim 문자열 제거");
// 다른 ns 파일에서 Config → using으로 Shop만 보이면 Shop 쪽
const shopUser = `using NyanDash.Shop;\nnamespace NyanDash.UI { class Panel { Config c; } }`;
assert.deepStrictEqual(csharpTypeRefs("Assets/Scripts/UI/Panel.cs", shopUser, index), ["Assets/Scripts/Shop/Config.cs"], "using한 ns 우선");
// 엔진 스텁 판별 — 선언 ns가 엔진(하위 ns 포함)이면 스텁, 이름만 비슷한 ns는 아님
assert.ok(isEngineStub("// stub\nnamespace Game {}\nnamespace UnityEngine.UI { class Button {} }"), "두 번째 ns가 UnityEngine.UI여도 스텁");
assert.ok(isEngineStub("namespace Godot { class Node {} }"), "Godot 스텁");
assert.ok(!isEngineStub("namespace UnityEngineExtras { class X {} }\nusing UnityEngine;"), "UnityEngineExtras·using은 스텁 아님");
console.log("typeRefs.check OK");
