import { urlCodec, useUrlState } from "@/features/lib/url-state";
import type { UrlStateSchema } from "@/features/lib/url-state";
import { COMPUTER_CLASS_KIND_SLUGS, EMPTY_COMPUTER_CLASS_FILTERS } from "./computer-class.schema";
import type { ComputerClassFilters } from "./computer-class.schema";

/* The filters as query parameters — /schedule/computer-classes?room=ауд. 305&from=2026-10-05
 * opens on that room and day, so the link can go into an announcement. Only
 * this file knows about the URL; the UI works with plain ComputerClassFilters. */

const COMPUTER_CLASS_URL_SCHEMA: UrlStateSchema<ComputerClassFilters> = {
    room: { key: "room", codec: urlCodec.text },
    kind: { key: "kind", codec: urlCodec.oneOf(COMPUTER_CLASS_KIND_SLUGS) },
    conflicts: { key: "conflicts", codec: urlCodec.oneOf(["only"] as const) },
    dateFrom: { key: "from", codec: urlCodec.isoDate },
    dateTo: { key: "to", codec: urlCodec.isoDate },
};

export const useComputerClassUrlFilters = () => useUrlState(COMPUTER_CLASS_URL_SCHEMA, EMPTY_COMPUTER_CLASS_FILTERS);
