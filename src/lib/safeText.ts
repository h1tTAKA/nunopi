// 문자열을 요청 본문(JSON)에 담기 전에 "짝 없는 UTF-16 surrogate"를 제거한다(#517).
// 긴 텍스트를 문자열 길이로 slice하면 이모지(surrogate pair) 중간이 잘려 외톨이 surrogate가
// 남고, 그러면 JSON.stringify 결과가 깨진 JSON이 돼 API가 400을 뱉는다. 정상 쌍은 보존.
export function stripLoneSurrogates(s: string): string {
  return s
    // 뒤에 low(\uDC00-\uDFFF)가 안 오는 high surrogate 제거 (slice 끝에서 잘린 반쪽)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    // 앞에 high(\uD800-\uDBFF)가 없는 low surrogate 제거 (혹시 모를 stray)
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}
