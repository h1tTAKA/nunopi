// 카드로 만들 만한 용어인가(#746 WorkspaceChat에서 분리, #998 캐치업 질문과 공용).
// 경로·파일명(확장자)·레포 파일 stem·camelCase/snake_case 코드 식별자는 암기카드감 아님.
// (API·REST·HTTP2·S3·v8 같은 약어/버전 개념은 험프·언더스코어가 없어 살아남음)
export function isCardWorthy(term: string, fileStems?: Set<string>): boolean {
  const t = term.trim();
  if (/[/\\]/.test(t)) return false;
  if (/\.(tsx?|jsx?|mjs|cjs|css|scss|less|json|ya?ml|toml|md|html?|vue|svelte|py|rb|go|rs|java|kt|kts|swift|scala|c|cc|cpp|cxx|h|hpp|cs|php|sh|sql)$/i.test(t)) return false;
  if (fileStems?.has(t.toLowerCase())) return false;
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(t) && (/[a-z][A-Z]/.test(t) || /_/.test(t))) return false;
  return true;
}
