// godotAssets 점검(#1011) — 실행: node --experimental-strip-types src/lib/repo/godotAssets.check.ts
import assert from "node:assert";
import { gdscriptRefs, godotExtResources, godotRelation, resolveRes } from "./godotAssets.ts";

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
console.log("godotAssets.check OK");
