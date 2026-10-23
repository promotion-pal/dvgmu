import { urlCodec, useUrlState } from "@/features/lib/url-state";
import type { UrlStateSchema } from "@/features/lib/url-state";
import { EMPTY_VACCINATION_FILTERS } from "./vaccination.schema";
import type { VaccinationFilters } from "./vaccination.schema";

/* The open day as a query parameter — /vaccination?day=3 — so a link to a
 * particular vaccination day can go into an announcement. */

const VACCINATION_URL_SCHEMA: UrlStateSchema<VaccinationFilters> = {
    dayId: { key: "day", codec: urlCodec.text },
};

export const useVaccinationUrlFilters = () => useUrlState(VACCINATION_URL_SCHEMA, EMPTY_VACCINATION_FILTERS);
