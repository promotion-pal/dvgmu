import { urlCodec, useUrlState } from "@/features/lib/url-state";
import type { UrlStateSchema } from "@/features/lib/url-state";
import type { Infrastructure } from "@dvgmu/fesmu/entity/v1/infrastructure.entity_pb";
import { useMemo } from "react";

interface InfrastructureFilter {
    search: string;
    floors: number[];
    location?: number;
}

const FILTER_SCHEMA: UrlStateSchema<InfrastructureFilter> = {
    search: { key: "q", codec: urlCodec.text },
    floors: { key: "floor", codec: urlCodec.list(urlCodec.integer) },
    location: { key: "type", codec: urlCodec.integer },
};
const FILTER_FALLBACK: InfrastructureFilter = { search: "", floors: [] };

/** Rooms in the order people look them up: by floor, then by room number,
 * then by title (so "ауд. 210" comes before "ауд. 210А", named rooms last). */
const compareInfrastructure = (a: Infrastructure, b: Infrastructure) =>
    a.floor - b.floor ||
    (a.room || Number.MAX_SAFE_INTEGER) - (b.room || Number.MAX_SAFE_INTEGER) ||
    a.title.localeCompare(b.title, "ru");

const sortInfrastructure = (list: Infrastructure[]) => [...list].sort(compareInfrastructure);

/** Search is by title, description and room number, ignoring case and the
 * "ауд." prefix, so "210а" finds "ауд. 210А". */
const matchesSearch = (item: Infrastructure, query: string) => {
    if (!query) return true;
    const haystack = `${item.title} ${item.description} ${item.room || ""}`.toLowerCase();
    return haystack.includes(query);
};

const filterInfrastructure = (list: Infrastructure[], filter: InfrastructureFilter) => {
    const query = filter.search.trim().toLowerCase();
    return sortInfrastructure(list).filter(
        (item) =>
            (filter.floors.length === 0 || filter.floors.includes(item.floor)) &&
            (filter.location === undefined || item.location === filter.location) &&
            matchesSearch(item, query),
    );
};

/** Consecutive runs of one floor; expects a list already sorted by floor. */
const groupByFloor = (list: Infrastructure[]) => {
    const groups: { floor: number; items: Infrastructure[] }[] = [];
    for (const item of list) {
        const last = groups[groups.length - 1];
        if (last && last.floor === item.floor) last.items.push(item);
        else groups.push({ floor: item.floor, items: [item] });
    }
    return groups;
};

const floorLabel = (floor: number) => (floor ? `${floor} этаж` : "Этаж не указан");

/** Filter state of the infrastructure page, kept in the URL. */
const useInfrastructureFilter = (list: Infrastructure[]) => {
    const [filter, setFilter] = useUrlState(FILTER_SCHEMA, FILTER_FALLBACK);

    const floorOptions = useMemo(
        () =>
            [...new Set(list.map((item) => item.floor))]
                .sort((a, b) => a - b)
                .map((floor) => ({ value: floor, label: floor ? String(floor) : "—" })),
        [list],
    );

    const filtered = useMemo(() => filterInfrastructure(list, filter), [list, filter]);

    return { filter, setFilter, floorOptions, filtered };
};

export type { InfrastructureFilter };
export {
    useInfrastructureFilter,
    filterInfrastructure,
    sortInfrastructure,
    matchesSearch,
    groupByFloor,
    floorLabel,
};
