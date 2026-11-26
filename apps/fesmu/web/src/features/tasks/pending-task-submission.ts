import { fromJsonString, toJsonString } from "@bufbuild/protobuf";
import {
  CreateTaskRequestSchema,
  type CreateTaskRequest,
} from "@fesmu/contract/tasks/service/task_service_pb";

export function pendingTaskKey(applicantId: string | undefined, serviceId: bigint) {
  return applicantId ? `tasks.pending.v1:${applicantId}:${serviceId}` : undefined;
}

export function readPendingTask(key: string | undefined, serviceId: bigint) {
  if (!key) return;
  try {
    const saved = sessionStorage.getItem(key);
    if (!saved) return;
    const request = fromJsonString(CreateTaskRequestSchema, saved);
    if (request.serviceId === serviceId && request.idempotencyKey && request.title) return request;
  } catch {
    // A blocked store or an unreadable entry still allows submitting from the form.
  }
}

export function savePendingTask(key: string | undefined, request: CreateTaskRequest) {
  if (!key) return;
  try {
    sessionStorage.setItem(key, toJsonString(CreateTaskRequestSchema, request));
  } catch {
    // The catalog retains the request if storage is unavailable.
  }
}

export function clearPendingTask(key: string | undefined, request: CreateTaskRequest) {
  if (!key) return;
  try {
    if (readPendingTask(key, request.serviceId)?.idempotencyKey === request.idempotencyKey) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable even if the submission itself succeeded.
  }
}
