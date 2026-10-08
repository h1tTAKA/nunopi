// 파일 종류 판별(#657) — 코드칸이 바이너리를 UTF-8로 우겨 읽어 깨진 글자를 보이던 문제. 순수 함수(import 없음, check 가능).
// svg는 XML 텍스트라 text(코드로 보기). 이미지 판별은 확장자, 그 외 바이너리는 NUL 바이트, 인코딩은 엄격 UTF-8 디코드로.
export type FileKind = "text" | "image" | "binary" | "non-utf8";

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif",
};
export const imageMime = (name: string): string | null => IMAGE_MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? null;

// partial=true: 파일 앞부분만 읽은 버퍼 — 끝에 잘린 멀티바이트 글자는 오류로 안 봄(stream 디코드).
export function classifyFile(buf: Uint8Array, name: string, partial = false): FileKind {
  if (imageMime(name)) return "image";
  const head = buf.subarray(0, 8192);
  if (head.includes(0)) return "binary"; // 텍스트엔 NUL이 없음(git과 같은 휴리스틱)
  try { new TextDecoder("utf-8", { fatal: true }).decode(buf, { stream: partial }); return "text"; } catch { return "non-utf8"; }
}
