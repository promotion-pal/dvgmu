import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import type { Service } from "@fesmu/contract/tasks/entity/service_pb";
import { CatalogService } from "@fesmu/contract/tasks/service/catalog_service_pb";

export const tasksTransport = createConnectTransport({
  baseUrl: new URL("/tasks-api", window.location.origin).href,
  fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: "omit" }),
});

const catalog = createClient(CatalogService, tasksTransport);

export async function listTaskServices(signal: AbortSignal): Promise<Service[]> {
  const services: Service[] = [];
  let afterId = 0n;

  do {
    const page = await catalog.listServices(
      { afterId, pageSize: 100 },
      { signal, timeoutMs: 5000 },
    );
    services.push(...page.services);
    afterId = page.nextAfterId;
  } while (afterId !== 0n);

  return services;
}
