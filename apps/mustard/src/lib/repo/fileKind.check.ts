// fileKind 점검(#657) — 실행: node --experimental-strip-types src/lib/repo/fileKind.check.ts
import assert from "node:assert";
import { classifyFile, imageMime } from "./fileKind.ts";

const enc = (s: string) => new TextEncoder().encode(s);
assert.strictEqual(classifyFile(enc("const a = 1; // 한글"), "a.ts"), "text", "UTF-8 텍스트");
assert.strictEqual(classifyFile(enc("<svg xmlns='x'/>"), "logo.svg"), "text", "svg는 텍스트");
assert.strictEqual(classifyFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]), "a.PNG"), "image", "이미지(확장자 대소문자 무시 + PNG 시그니처)");
assert.strictEqual(classifyFile(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]), "p.jpg"), "image", "JPEG 시그니처");
assert.strictEqual(classifyFile(new Uint8Array([1, 2, 0, 9]), "fake.png"), "binary", "png 이름이지만 시그니처 불일치 → 바이너리(#1018 리뷰)");
assert.strictEqual(classifyFile(enc("not an image"), "note.png"), "text", "png 이름의 텍스트 → 텍스트");
assert.strictEqual(classifyFile(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 1]), "a.zip"), "binary", "NUL 있는 바이너리");
assert.strictEqual(classifyFile(new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb]), "euckr.txt"), "non-utf8", "EUC-KR '한글'은 UTF-8 아님");
assert.strictEqual(classifyFile(new Uint8Array([]), "empty.txt"), "text", "빈 파일은 텍스트");
assert.strictEqual(imageMime("x.jpeg"), "image/jpeg");
assert.strictEqual(imageMime("x.ts"), null);
const cut = enc("가나다").subarray(0, 4); // '나' 중간에서 잘림
assert.strictEqual(classifyFile(cut, "a.txt", true), "text", "앞부분만 읽어 끝 글자가 잘린 건 텍스트");
assert.strictEqual(classifyFile(cut, "a.txt"), "non-utf8", "전체 파일인데 잘린 글자면 non-utf8");
console.log("fileKind.check OK");
