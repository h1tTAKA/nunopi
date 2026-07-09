// 학습 챗에서 제안된 용어를 북마크 카드로 저장. 위치(kind)에 맞는 store에 최소 detail을 만든다.
// kind: token(토큰 사전) | concept(개념 사전) | term(IT용어 사전) — 저장하면 사전·암기 덱·갤러리에 자동 노출.
import {
  saveTokenDetail, saveConceptDetail, saveTermDetail,
  loadTokenDetails, loadConceptDetails, loadTermDetails,
  type SourceExtra,
} from "./bookmarkDetails";
import type { SuggestKind } from "./cardSuggestion";

// 이미 있는 카드면 건드리지 않는다(기존 출처/설명 보존). 반환: 새로 만들었으면 true.
export function createChatCard(
  kind: SuggestKind,
  term: string,
  definition: string,
  sourceTitle: string | undefined,
  sourceId: string | undefined,
  extra: SourceExtra,
): boolean {
  const t = term.trim();
  if (!t) return false;
  if (kind === "token") {
    if (loadTokenDetails()[t]) return false;
    // 챗 생성 토큰 — 최소 필드(category는 기본 keyword). collectCards는 token/description만 사용.
    saveTokenDetail({ id: `chat:${t}`, token: t, category: "keyword", label: t, description: definition, lines: [], bookmarkable: true }, sourceTitle, sourceId, extra);
    return true;
  }
  if (kind === "term") {
    if (loadTermDetails()[t]) return false;
    saveTermDetail({ id: `chat:${t}`, term: t, explanation: definition, conceptIds: [], bookmarkable: true }, sourceTitle, sourceId, extra);
    return true;
  }
  // concept — 키 = title.
  if (loadConceptDetails()[t]) return false;
  saveConceptDetail({ conceptId: `chat:${t}`, title: t, description: definition }, sourceTitle, sourceId, extra);
  return true;
}
