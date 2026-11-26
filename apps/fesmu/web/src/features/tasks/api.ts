import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import type { Service } from "@fesmu/contract/tasks/entity/service_pb";
import { CatalogService } from "@fesmu/contract/tasks/service/catalog_service_pb";
import { DirectionService } from "@fesmu/contract/tasks/service/direction_service_pb";
import {
  PriorityService,
  type PriorityCursor,
} from "@fesmu/contract/tasks/service/priority_service_pb";
import { ServiceFormService } from "@fesmu/contract/tasks/service/service_form_service_pb";
import { ServiceRoutesService } from "@fesmu/contract/tasks/service/service_routes_service_pb";
import { StatusService, type StatusCursor } from "@fesmu/contract/tasks/service/status_service_pb";
import { TaskService } from "@fesmu/contract/tasks/service/task_service_pb";
import { connectTransport } from "@/shared/config/api";

export const tasksTransport = createConnectTransport({
  baseUrl: new URL("/tasks-api", window.location.origin).href,
  fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: "omit" }),
});

export const taskCatalog = createClient(CatalogService, tasksTransport);
export const taskDirections = createClient(DirectionService, tasksTransport);
export const taskPriorities = createClient(PriorityService, tasksTransport);
export const taskStatuses = createClient(StatusService, tasksTransport);
export const taskServiceRoutes = createClient(ServiceRoutesService, tasksTransport);
export const taskCallOptions = { timeoutMs: 5000 };

const taskForms = createClient(ServiceFormService, tasksTransport);
export const taskClient = createClient(TaskService, connectTransport);

export function getTaskServiceForm(serviceId: bigint, signal: AbortSignal) {
  return taskForms.getServiceForm({ serviceId }, { ...taskCallOptions, signal });
}

async function collectPages<Item, Cursor>(
  read: (cursor?: Cursor) => Promise<{ items: Item[]; next?: Cursor }>,
): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: Cursor | undefined;

  do {
    const page = await read(cursor);
    items.push(...page.items);
    cursor = page.next;
  } while (cursor !== undefined);

  return items;
}

export function listTaskServices(signal: AbortSignal): Promise<Service[]> {
  return collectPages(async (afterId: bigint = 0n) => {
    const page = await taskCatalog.listServices(
      { afterId, pageSize: 100 },
      { ...taskCallOptions, signal },
    );
    return { items: page.services, next: page.nextAfterId || undefined };
  });
}

export function listTaskDirections(signal: AbortSignal) {
  return collectPages(async (afterId: bigint = 0n) => {
    const page = await taskDirections.listDirections(
      { afterId, pageSize: 100 },
      { ...taskCallOptions, signal },
    );
    return { items: page.directions, next: page.nextAfterId || undefined };
  });
}

export function listTaskStatuses(signal: AbortSignal) {
  return collectPages(async (after?: StatusCursor) => {
    const page = await taskStatuses.listStatuses(
      { after, pageSize: 100 },
      { ...taskCallOptions, signal },
    );
    return { items: page.statuses, next: page.nextCursor };
  });
}

export function listTaskPriorities(signal: AbortSignal) {
  return collectPages(async (after?: PriorityCursor) => {
    const page = await taskPriorities.listPriorities(
      { after, pageSize: 100 },
      { ...taskCallOptions, signal },
    );
    return { items: page.priorities, next: page.nextCursor };
  });
}
