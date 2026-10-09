// modelCatalog 점검(#1021) — 실행: node --experimental-strip-types packages/nunopi/src/lib/agent/modelCatalog.check.ts
import assert from "node:assert";
import { codexConfigModel, mergeClaudeModels } from "./modelCatalog.ts";

const sna = [
  { id: "opus", label: "Claude Opus 4.7 (alias)" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];
const ids = mergeClaudeModels(sna).map((m) => m.id);
assert.deepStrictEqual(ids.slice(0, 4), ["fable", "opus", "sonnet", "haiku"], "별칭 맨 위(fable 포함)");
assert.deepStrictEqual(ids.slice(4, 8), ["claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"], "최신 정식 ID");
assert.ok(ids.includes("claude-opus-4-7"), "SNA 구버전 정식 ID 유지");
assert.strictEqual(ids.length, new Set(ids).size, "중복 없음");
assert.strictEqual(mergeClaudeModels(sna).find((m) => m.id === "opus")?.label, "Opus", "SNA 구버전 별칭 라벨은 버림");

assert.strictEqual(codexConfigModel('model = "gpt-5.6-sol"\nmodel_reasoning_effort = "medium"\n'), "gpt-5.6-sol");
assert.strictEqual(codexConfigModel('approval = "x"\n\n[profiles.fast]\nmodel = "gpt-5.6-luna"\n'), null, "프로필 테이블 안 model은 무시");
assert.strictEqual(codexConfigModel("# 주석\n  model='gpt-6-astra'\n[x]\nmodel=\"y\""), "gpt-6-astra", "작은따옴표·들여쓰기");
assert.strictEqual(codexConfigModel(""), null);
console.log("modelCatalog.check OK");
