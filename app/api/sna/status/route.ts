import { getSnaServer } from "@/lib/sna/server";

// 런타임 서버 헬스체크. 외부 서버(일렉트론 main 소유)면 external:true, 아니면 임베드 { ready, port }.
export async function GET() {
  if (process.env.SNA_BASE_URL) {
    return Response.json({ ready: true, external: true });
  }
  try {
    const sna = await getSnaServer();
    return Response.json({ ready: true, port: sna.port });
  } catch (e) {
    return Response.json({ ready: false, error: String(e) }, { status: 503 });
  }
}
