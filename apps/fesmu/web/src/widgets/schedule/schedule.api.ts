import { createClient } from "@connectrpc/connect";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { ScheduleService } from "@fesmu/contract/fesmu/service/v1/schedule.service_pb";
import { connectTransport } from "@/shared/config/api";

import type { ScheduleTimetable } from "./schedule.schema";
import { fromMessage, toMessage } from "./schedule.message";
export { fromMessage, toMessage } from "./schedule.message";

const client = createClient(ScheduleService, connectTransport);

/** The only place the widget talks to the schedule service. */
export const scheduleApi = {
    async fetch(): Promise<ScheduleTimetable[]> {
        const response = await client.scheduleFetch({});
        return response.list.map(fromMessage);
    },

    async byId(id: string) {
        const response = await client.scheduleByID({ id });
        return response.item ? { timetable: fromMessage(response.item), updatedAt: response.item.updatedAt } : undefined;
    },

    async create(timetable: ScheduleTimetable): Promise<string> {
        const response = await client.scheduleCreate({ item: toMessage(timetable) });
        return response.scheduleId;
    },

    async update(timetable: ScheduleTimetable, updatedAt: Timestamp | undefined): Promise<void> {
        await client.scheduleUpdate({ item: { ...toMessage(timetable), updatedAt } });
    },

    async remove(id: string): Promise<void> {
        await client.scheduleDelete({ id });
    },
};
