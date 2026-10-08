// 캐치업 내레이션 중복 방지(#1019) — 탭 클릭·앱 재시작으로 터미널이 resize되면 Claude Code TUI가 화면 전체를 다시 그려
// 옛 출력이 onData로 그대로 재유입 → "새 활동"으로 오인해 같은 화면을 또 해설하던 문제.
// 세션별로 "이미 본 텍스트"를 공백 없이 이어 붙인 말뭉치에 두고, 델타 줄이 그 안에 이미 있으면 버린다.
// 공백 제거 + 부분문자열 비교라 resize로 줄바꿈 위치가 바뀌어도(같은 문장이 다르게 잘림) 같은 내용으로 인식.
// ponytail: 짧은 흔한 줄("}" 등)은 새 줄이어도 기존에 있으면 버려짐 — 내레이션 기준(150자)엔 영향 미미.
const CAP = 250_000; // 말뭉치 꼬리 상한(세션당) — 데몬 버퍼(200KB, ANSI 포함) 전체를 덮을 만큼(TUI가 resize 때 대화 전체를 다시 그림)

const norm = (line) => String(line).replace(/\s+/g, "");

// 이미 본 텍스트를 말뭉치에 추가해 새 말뭉치를 반환. 이미 들어 있는 줄은 다시 안 넣음(#1020 리뷰: 시딩 두 번에 말뭉치 중복 증식).
function seen(corpus, text) {
  const c = corpus || "";
  const add = String(text || "").split("\n").map(norm).filter((n) => n && !c.includes(n)).join("\n");
  if (!add) return c;
  const next = (c ? c + "\n" : "") + add;
  return next.length > CAP ? next.slice(-CAP) : next;
}

// 델타에서 말뭉치에 없는 줄만 남김. { fresh, corpus } — corpus엔 이번 델타 전체를 반영.
function freshLines(corpus, text) {
  const c = corpus || "";
  const lines = String(text || "").split("\n");
  const fresh = lines.filter((l) => { const n = norm(l); return n && !c.includes(n); }).join("\n");
  return { fresh, corpus: seen(c, text) };
}

module.exports = { seen, freshLines };
