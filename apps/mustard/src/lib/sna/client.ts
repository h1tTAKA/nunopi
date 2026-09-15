import "server-only";
import { SnaClient } from "@sna-sdk/client";
import { getSnaServer } from "./server";

// SnaClient 싱글톤. 분석·챗에서 재사용.
// - SNA_BASE_URL 있으면(일렉트론 main이 런타임 서버 소유) 그 외부 서버에 연결(임베드 안 함).
// - 없으면(dev/web) getSnaServer로 임베드 후 연결.
const g = globalThis as unknown as { __snaClient?: Promise<SnaClient> };

export function getSnaClient(): Promise<SnaClient> {
  if (!g.__snaClient) {
    g.__snaClient = (async () => {
      const externalBaseUrl = process.env.SNA_BASE_URL?.trim();
      if (externalBaseUrl) {
        const client = new SnaClient({ baseUrl: externalBaseUrl, authToken: process.env.SNA_AUTH_TOKEN });
        client.connect();
        return client;
      }
      const sna = await getSnaServer();
      const client = new SnaClient(sna.connection);
      client.connect();
      return client;
    })();
  }
  return g.__snaClient;
}
