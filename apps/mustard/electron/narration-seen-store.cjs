// 이미 본 텍스트 상태의 레포별 파일 저장(#1031) — userData/narration-seen/<sha1(cwd)>.json. 앱 재시작 후 resume에도 유지.
// 손상·없음이면 빈 상태(해설이 한 번 더 나올 뿐, 앱은 안 막음).
const { readFileSync, writeFileSync, mkdirSync, renameSync } = require("node:fs");
const { join } = require("node:path");
const { createHash } = require("node:crypto");
const { emptyState } = require("./narration-dedupe.cjs");

const fileFor = (dir, cwd) => join(dir, `${createHash("sha1").update(String(cwd)).digest("hex")}.json`);

function loadSeen(dir, cwd) {
  try {
    const j = JSON.parse(readFileSync(fileFor(dir, cwd), "utf8"));
    if (j && typeof j.corpus === "string" && Array.isArray(j.hashes)) return { corpus: j.corpus, hashes: j.hashes.filter((h) => typeof h === "string") };
  } catch { /* 없음·손상 */ }
  return emptyState();
}

function saveSeen(dir, cwd, state) {
  try {
    mkdirSync(dir, { recursive: true });
    const f = fileFor(dir, cwd);
    writeFileSync(`${f}.tmp`, JSON.stringify({ cwd, corpus: state.corpus, hashes: state.hashes }));
    renameSync(`${f}.tmp`, f); // 원자적 교체 — 쓰다 죽어도 반쪽 파일 안 남음
    return true;
  } catch { return false; }
}

module.exports = { loadSeen, saveSeen };
