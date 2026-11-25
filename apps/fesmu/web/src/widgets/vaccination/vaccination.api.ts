import { createClient } from "@connectrpc/connect";
import type { VaccinationDay as DayMessage } from "@fesmu/contract/fesmu/entity/v1/vaccination.entity_pb";
import { VaccinationService } from "@fesmu/contract/fesmu/service/v1/vaccination.service_pb";
import { connectTransport } from "@/shared/config/api";
import type { VaccinationDay, VaccinationDayForm } from "./vaccination.schema";

const client = createClient(VaccinationService, connectTransport);

const fromMessage = (message: DayMessage): VaccinationDay => ({
    id: message.id.toString(),
    date: message.date,
    title: message.title,
    place: message.place || undefined,
    note: message.note || undefined,
    slots: message.slots.map((slot) => ({
        id: slot.id.toString(),
        timeStart: slot.timeStart,
        timeEnd: slot.timeEnd,
        capacity: slot.capacity,
        signups: slot.signups.map((signup) => ({ id: signup.id.toString(), fullName: signup.fullName })),
    })),
});

/** The only place the widget talks to the vaccination service. */
export const vaccinationApi = {
    async fetch(dateFrom?: string): Promise<VaccinationDay[]> {
        const response = await client.vaccinationDayFetch({ dateFrom: dateFrom ?? "" });
        return response.list.map(fromMessage);
    },

    async signup(slotId: string, fullName: string, consent: boolean): Promise<void> {
        await client.vaccinationSignupCreate({ slotId: BigInt(slotId), fullName, personalDataConsent: consent });
    },

    async removeSignup(id: string): Promise<void> {
        await client.vaccinationSignupDelete({ id: BigInt(id) });
    },

    async createDay(values: VaccinationDayForm): Promise<void> {
        await client.vaccinationDayCreate(values);
    },

    async removeDay(id: string): Promise<void> {
        await client.vaccinationDayDelete({ id: BigInt(id) });
    },
};
