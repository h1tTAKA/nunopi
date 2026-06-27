import { getSnaServer } from "@/lib/sna/server";

// 임베드 런타임 서버 헬스체크. { ready, port } 또는 503.
export async function GET() {
  try {
    const sna = await getSnaServer();
    return Response.json({ ready: true, port: sna.port });
  } catch (e) {
    return Response.json({ ready: false, error: String(e) }, { status: 503 });
  }
}
