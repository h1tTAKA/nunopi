// Next.js가 서버 부팅 시 1회 호출하는 훅. 에이전트 런타임 서버를 미리 띄워
// 첫 분석 지연을 없앤다. 부팅 실패해도 앱은 정상 기동(런타임 사용 시점 에러는 별도 처리).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // edge/브라우저 런타임 제외
  // 외부 런타임 서버(일렉트론 main 소유)면 임베드 스킵 — SnaClient가 SNA_BASE_URL로 연결.
  if (process.env.SNA_BASE_URL) { console.log("[sna] external runtime — skip embed"); return; }
  try {
    const { getSnaServer } = await import("@/lib/sna/server");
    const sna = await getSnaServer();
    console.log("[sna] embedded runtime ready on", sna.port);
  } catch (e) {
    console.error("[sna] embedded runtime boot failed:", e);
  }
}
