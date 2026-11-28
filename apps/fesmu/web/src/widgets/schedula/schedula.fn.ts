import { useEffect, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import type { EventType } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import type { CatalogFetchResponse, PublicScheduleFetchResponse, ScheduleFetchResponse } from "@fesmu/contract/schedula/service/schedula.service_pb";
import { urlCodec, useUrlState, type UrlStateSchema } from "@/features/lib/url-state";
import { schedulaClient } from "./schedula.api";
import { scheduleDate } from "./schedula.utils";

interface FilterState {
    dateFrom?: string;
    dateTo?: string;
    group?: string;
    subgroup?: string;
    course?: number;
    instructorId?: string;
    subjectId?: string;
    siteId?: string;
    roomId?: string;
    type?: number;
    sources?: number[];
    view?: "mine" | "all";
    layout?: "grid" | "list";
}

const dateCodec = { ...urlCodec.isoDate, parse: (value: string | null) => scheduleDate(value ?? undefined) };

const filterSchema: UrlStateSchema<FilterState> = {
    dateFrom: { key: "from", codec: dateCodec },
    dateTo: { key: "to", codec: dateCodec },
    group: { key: "group", codec: urlCodec.text },
    subgroup: { key: "subgroup", codec: urlCodec.text },
    course: { key: "course", codec: urlCodec.integer },
    instructorId: { key: "teacher", codec: urlCodec.text },
    subjectId: { key: "subject", codec: urlCodec.text },
    siteId: { key: "site", codec: urlCodec.text },
    roomId: { key: "room", codec: urlCodec.text },
    type: { key: "type", codec: urlCodec.integer },
    sources: { key: "sources", codec: urlCodec.list(urlCodec.integer) },
    view: { key: "view", codec: urlCodec.oneOf(["mine", "all"]) },
    layout: { key: "layout", codec: urlCodec.oneOf(["grid", "list"]) },
};

const defaultFilter: FilterState = {};

type ScheduleState =
    | { key: object; personal: boolean; kind: "private"; result: ScheduleFetchResponse }
    | { key: object; personal: boolean; kind: "public"; result: PublicScheduleFetchResponse }
    | { key: object; personal: boolean; kind: "error"; error: ConnectError };

export function useSchedula(publicView: boolean, defaultPersonal: boolean) {
    const [filter, setFilter] = useUrlState(filterSchema, defaultFilter);
    const [version, setVersion] = useState(0);
    const [state, setState] = useState<ScheduleState>();
    const [catalog, setCatalog] = useState<CatalogFetchResponse>();
    const [catalogError, setCatalogError] = useState<ConnectError>();
    const personal = !publicView && !filter.group && !filter.course &&
        (filter.view === "mine" || (filter.view !== "all" && defaultPersonal));

    useEffect(() => {
        const controller = new AbortController();
        const request = {
            dateFrom: filter.dateFrom ?? filter.dateTo,
            dateTo: filter.dateTo,
            group: filter.group,
            subgroup: publicView ? undefined : filter.subgroup,
            course: filter.course,
            instructorId: publicView ? undefined : filter.instructorId,
            subjectId: filter.subjectId,
            siteId: filter.siteId,
            roomId: filter.roomId,
            type: filter.type as EventType | undefined,
            types: filter.sources as EventType[] | undefined,
        };
        const load = async () => {
            try {
                if (publicView) {
                    const result = await schedulaClient.publicScheduleFetch({ filter: request }, { signal: controller.signal });
                    if (!controller.signal.aborted) setState({ key: filter, personal, kind: "public", result });
                } else {
                    const result = await schedulaClient.scheduleFetch({ filter: request, personal, includeDrafts: !personal }, { signal: controller.signal });
                    if (!controller.signal.aborted) setState({ key: filter, personal, kind: "private", result });
                }
            } catch (cause) {
                if (!controller.signal.aborted) setState({ key: filter, personal, kind: "error", error: ConnectError.from(cause) });
            }
        };
        void load();
        return () => controller.abort();
    }, [filter, personal, publicView, version]);

    useEffect(() => {
        if (publicView) return;
        const controller = new AbortController();
        schedulaClient.catalogFetch({}, { signal: controller.signal }).then(
            (result) => {
                if (controller.signal.aborted) return;
                setCatalog(result);
                setCatalogError(undefined);
            },
            (cause: unknown) => {
                if (!controller.signal.aborted) setCatalogError(ConnectError.from(cause));
            },
        );
        return () => controller.abort();
    }, [publicView, version]);

    return {
        filter, setFilter, personal, state: state?.key === filter && state.personal === personal &&
            (state.kind === "error" || (state.kind === "public") === publicView) ? state : undefined,
        catalog, catalogError, reload: () => setVersion((v) => v + 1),
    };
}
