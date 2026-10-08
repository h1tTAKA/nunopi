// godotAssets 점검(#1011) — 실행: node --experimental-strip-types src/lib/repo/godotAssets.check.ts
import assert from "node:assert";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gdscriptRefs, godotEdges, godotExtResources, godotRelation, resolveRes } from "./godotAssets.ts";
import { scanRepo } from "./scan.ts";

// Godot 4 + Godot 3 형식, 속성 순서 무관, res:// 아닌 것 제외
const tscn = `[gd_scene load_steps=4 format=3 uid="uid://abc"]

[ext_resource type="Script" uid="uid://s1" path="res://player/player.gd" id="1_x"]
[ext_resource type="PackedScene" path="res://enemy/enemy.tscn" id="2_y"]
[ext_resource path="res://items/sword.tres" type="Resource" id=3]
[ext_resource type="Texture2D" path="res://art/cat.png" id="4"]

[node name="Root" type="Node2D"]
script = ExtResource("1_x")
[node name="Enemy" parent="." instance=ExtResource("2_y")]`;
assert.deepStrictEqual(godotExtResources(tscn).map((r) => `${r.type}:${r.path}`), [
  "Script:res://player/player.gd", "PackedScene:res://enemy/enemy.tscn", "Resource:res://items/sword.tres", "Texture2D:res://art/cat.png",
], "ext_resource 추출");

const gd = `@tool
class_name Player
extends "res://base/actor.gd"
# const Old = preload("res://old.tscn")
const Bullet = preload("res://bullet/bullet.tscn")
var cfg = load('res://data/cfg.tres')`;
assert.deepStrictEqual(gdscriptRefs(gd), { paths: ["res://bullet/bullet.tscn", "res://data/cfg.tres", "res://base/actor.gd"], className: "Player", extendsName: null }, "gd 참조(주석 줄 제외)");
assert.deepStrictEqual(gdscriptRefs("extends CharacterBody2D\nfunc _ready():\n  pass"), { paths: [], className: null, extendsName: "CharacterBody2D" }, "이름 extends");

const files = new Set(["game/player/player.gd", "game/enemy/enemy.tscn", "other/player/player.gd"]);
assert.strictEqual(resolveRes("res://player/player.gd", "game/main.tscn", files), "game/player/player.gd", "같은 Godot 루트(game/)");
assert.strictEqual(resolveRes("res://enemy/enemy.tscn", "game/player/player.gd", files), "game/enemy/enemy.tscn", "하위 폴더에서 루트로 올라가며");
assert.strictEqual(resolveRes("res://nope.gd", "game/main.tscn", files), null, "없는 경로");

assert.strictEqual(godotRelation("a/p.gd"), "uses");
assert.strictEqual(godotRelation("a/x.tres"), "uses");
assert.strictEqual(godotRelation("a/e.tscn"), "instantiates");
assert.strictEqual(godotRelation("a/cat.png"), null);
// --- 픽스처 끝까지: Godot 루트가 레포 하위(game/), 스캔 → godotEdges ---
const root = mkdtempSync(join(tmpdir(), "godot-check-"));
const put = (rel: string, body: string) => { const p = join(root, rel); mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, body); };
put("game/project.godot", "config_version=5");
put("game/main.tscn", `[ext_resource type="Script" path="res://main.gd" id="1"]\n[ext_resource type="PackedScene" path="res://enemy/enemy.tscn" id="2"]\n[ext_resource type="Texture2D" path="res://icon.png" id="3"]`);
put("game/main.gd", `extends Node\nconst Bullet = preload("res://bullet.gd")`);
put("game/bullet.gd", `class_name Bullet\nextends Area2D`);
put("game/enemy/enemy.tscn", `[ext_resource type="Script" path="res://enemy/enemy.gd" id="1"]\n[ext_resource type="Resource" path="res://enemy/stats.tres" id="2"]`);
put("game/enemy/enemy.gd", `extends Actor`);
put("game/actor.gd", `class_name Actor\nextends CharacterBody2D`);
put("game/enemy/stats.tres", `[gd_resource type="Resource" format=3]`);
put("game/.godot/imported/cache.gd", "extends Node"); // #1003 엔진 캐시 — 스캔 제외
put("web/theme.tres", "x"); // Godot 루트 밖 — 스캔 제외
const scanned = scanRepo(root).files;
assert.ok(!scanned.some((f) => f.includes(".godot/")) && !scanned.includes("web/theme.tres"), "Godot 캐시·루트 밖 파일 제외");
const texts = new Map(scanned.filter((f) => f.startsWith("game/")).map((f) => [f, readFileSync(join(root, f), "utf8")] as [string, string]));
assert.deepStrictEqual(scanRepo(root).godotRoots, ["game"], "Godot 루트 수집");
const got = godotEdges(texts, new Set(scanned), scanRepo(root).godotRoots).map((e) => `${e.source} -${e.relation}-> ${e.target}`).sort();
assert.deepStrictEqual(got, [
  "game/enemy/enemy.gd -imports-> game/actor.gd",
  "game/enemy/enemy.tscn -uses-> game/enemy/enemy.gd",
  "game/enemy/enemy.tscn -uses-> game/enemy/stats.tres",
  "game/main.gd -imports-> game/bullet.gd",
  "game/main.tscn -instantiates-> game/enemy/enemy.tscn",
  "game/main.tscn -uses-> game/main.gd",
], "씬→스크립트·하위 씬·리소스, gd→preload·class_name extends(엔진 클래스·텍스처 제외)");
// res:// = 프로젝트 루트 기준(#1012 리뷰) — 하위 폴더 동명 파일 말고 루트의 것, 다른 Godot 프로젝트로 새지 않음
const fs2 = new Set(["g1/levels/player.gd", "g1/player.gd", "g1/levels/a.tscn", "g2/enemy.gd", "enemy.gd"]);
assert.strictEqual(resolveRes("res://player.gd", "g1/levels/a.tscn", fs2, ["g1", "g2"]), "g1/player.gd", "res://는 프로젝트 루트 기준");
assert.strictEqual(resolveRes("res://enemy.gd", "g1/levels/a.tscn", fs2, ["g1", "g2"]), null, "다른 프로젝트·레포 루트로 새지 않음");
assert.strictEqual(resolveRes("res://enemy.gd", "g2/main.tscn", fs2, ["", "g2"]), "g2/enemy.gd", "중첩 루트는 가장 가까운 것");
// Godot C#: 씬이 .cs 스크립트를 쓰면 uses
const csEdges = godotEdges(new Map([["c/main.tscn", '[ext_resource type="Script" path="res://Player.cs" id="1"]']]), new Set(["c/main.tscn", "c/Player.cs"]), ["c"]);
assert.deepStrictEqual(csEdges, [{ source: "c/main.tscn", target: "c/Player.cs", relation: "uses" }], "Godot C# 스크립트 연결");
console.log("godotAssets.check OK");
