import { create } from "@bufbuild/protobuf";
import type { Analytic } from "@dvgmu/contract/packages/analytics/entity/analytic.entity_pb";
import { AnalyticFetchRequestSchema } from "@dvgmu/contract/packages/analytics/service/analytic.service_pb";

import { analyticClient } from "./analytic.fn";

export type ScanTarget = { qr: bigint } | { id: bigint };

/** Что зашито в код: ссылка анкеты `/analytic?qr=N` (сейчас), старая `?id=N`
 * (первые таблички) или просто номер QR. */
export const parseAnalyticScan = (text: string): ScanTarget | undefined => {
  const raw = text.trim();
  let params: URLSearchParams | undefined;
  try {
    params = new URL(raw).searchParams;
  } catch {
    params = raw.includes("?") ? new URLSearchParams(raw.slice(raw.indexOf("?"))) : undefined;
  }
  const qr = params?.get("qr");
  if (qr && /^\d+$/.test(qr)) return { qr: BigInt(qr) };
  const id = params?.get("id");
  if (id && /^\d+$/.test(id)) return { id: BigInt(id) };
  if (/^\d+$/.test(raw)) return { qr: BigInt(raw) };
  return undefined;
};

/** Объект по коду; при повторе номера — с меньшим id, как и анкета. */
export const resolveScan = async (target: ScanTarget): Promise<Analytic | undefined> => {
  if ("id" in target) {
    return (await analyticClient.analyticByID({ id: target.id }).catch(() => undefined))?.entity;
  }
  let found: Analytic | undefined;
  for await (const chunk of analyticClient.analyticFetch(create(AnalyticFetchRequestSchema, { qr: target.qr }))) {
    const e = chunk.entity;
    if (e && e.qr === target.qr && (!found || e.id < found.id)) found = e;
  }
  return found;
};

