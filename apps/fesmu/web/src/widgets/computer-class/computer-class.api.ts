import { createClient } from "@connectrpc/connect";
import type { ComputerClassSession as SessionMessage } from "@fesmu/contract/entity/v1/computer_class.entity_pb";
import { ComputerClassService } from "@fesmu/contract/service/v1/computer_class.service_pb";
import { connectTransport } from "@/shared/config/api";
import type { ComputerClassSession, ComputerClassSessionForm } from "./computer-class.schema";

const client = createClient(ComputerClassService, connectTransport);

const fromMessage = (message: SessionMessage): ComputerClassSession => ({
    id: message.id.toString(),
    date: message.date,
    timeStart: message.timeStart,
    timeEnd: message.timeEnd,
    room: message.room,
    kind: message.kind,
    title: message.title,
    groups: message.groups || undefined,
    note: message.note || undefined,
});

/** The only place the widget talks to the computer class service. */
export const computerClassApi = {
    async fetch(): Promise<ComputerClassSession[]> {
        const response = await client.computerClassSessionFetch({});
        return response.list.map(fromMessage);
    },

    async create(values: ComputerClassSessionForm): Promise<void> {
        await client.computerClassSessionCreate(values);
    },

    async update(id: string, values: ComputerClassSessionForm): Promise<void> {
        await client.computerClassSessionUpdate({ id: BigInt(id), ...values });
    },

    async remove(id: string): Promise<void> {
        await client.computerClassSessionDelete({ id: BigInt(id) });
    },
};
