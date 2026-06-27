import "server-only";
import { SnaClient } from "@sna-sdk/client";
import { getSnaServer } from "./server";

// 임베드 서버에 붙은 SnaClient 싱글톤. ②(분석)·③(챗)에서 재사용.
const g = globalThis as unknown as { __snaClient?: Promise<SnaClient> };

export function getSnaClient(): Promise<SnaClient> {
  if (!g.__snaClient) {
    g.__snaClient = (async () => {
      const sna = await getSnaServer();
      const client = new SnaClient(sna.connection);
      client.connect();
      return client;
    })();
  }
  return g.__snaClient;
}
