// 문자열을 요청 본문(JSON)에 담기 전에 "짝 없는 UTF-16 surrogate"를 제거한다(#517).
// 긴 텍스트를 문자열 길이로 slice하면 이모지(surrogate pair) 중간이 잘려 외톨이 surrogate가
// 남고, 그러면 API가 요청 JSON을 "no low surrogate" 로 거부(400)한다. 정상 쌍은 보존.
//
// 정규식 lookbehind(ES2018+) 회피를 위해 코드유닛을 순회하며 조립한다.
export function stripLoneSurrogates(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      // high surrogate — 바로 뒤 low가 오면 정상 쌍(둘 다 유지), 아니면 외톨이(버림).
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += s[i] + s[i + 1];
        i++;
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      // 앞에 high 없이 온 low surrogate — 외톨이(버림).
    } else {
      out += s[i];
    }
  }
  return out;
}
