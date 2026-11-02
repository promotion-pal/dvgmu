import { createClient } from "@connectrpc/connect";
import type { Hall as HallMessage, HallBooking as HallBookingMessage } from "@fesmu/contract/fesmu/entity/v1/hall.entity_pb";
import { HallBookingStatus } from "@fesmu/contract/fesmu/enum/v1/hall.enum_pb";
import { HallService } from "@fesmu/contract/fesmu/service/v1/hall.service_pb";
import { connectTransport } from "@/shared/config/api";
import { scheduleToneSchema } from "../schedule.schema";
import { hallEventSchema, hallSchema } from "./schedule_hall.schema";
import type { Hall, HallBookingSchema, HallEvent } from "./schedule_hall.schema";

const client = createClient(HallService, connectTransport);

/** Contract ids are int64 (bigint); the widget keys everything by string. */
const fromHallMessage = (message: HallMessage, index: number): Hall =>
    hallSchema.parse({
        id: message.id.toString(),
        name: message.name,
        building: message.building,
        tone: scheduleToneSchema.safeParse(message.tone).data ?? scheduleToneSchema.options[index % scheduleToneSchema.options.length],
    });

const fromBookingMessage = (message: HallBookingMessage): HallEvent =>
    hallEventSchema.parse({
        id: message.id.toString(),
        hallId: message.hallId.toString(),
        date: message.date,
        timeStart: message.timeStart,
        timeEnd: message.timeEnd,
        title: message.title,
        organizer: message.organizer || undefined,
        contact: message.contact || undefined,
        status: ({
            [HallBookingStatus.PENDING]: "pending",
            [HallBookingStatus.APPROVED]: "approved",
            [HallBookingStatus.REJECTED]: "rejected",
            [HallBookingStatus.CANCELLED]: "cancelled",
        } as Record<number, "pending" | "approved" | "rejected" | "cancelled">)[message.status] ?? "approved",
        reviewComment: message.reviewComment || undefined,
        reviewedBy: message.reviewedBy || undefined,
    });

/** Who is looking: staff see who booked a hall, everyone else only when. */
export type HallViewer = "staff" | "public";

/** The only place the hall widgets talk to the hall service. */
export const hallApi = {
    async fetchHalls(): Promise<Hall[]> {
        const response = await client.hallFetch({});
        return response.list.map(fromHallMessage);
    },

    async fetchBookings(viewer: HallViewer): Promise<HallEvent[]> {
        const response =
            viewer === "staff" ? await client.hallBookingFetch({}) : await client.hallBookingPublicFetch({});
        return response.list.map(fromBookingMessage);
    },
    async fetchMine(): Promise<HallEvent[]> {
        const response = await client.hallBookingMineFetch({});
        return response.list.map(fromBookingMessage);
    },

    async createBooking(values: HallBookingSchema): Promise<void> {
        await client.hallBookingCreate({
            hallId: BigInt(values.hallId),
            date: values.date,
            timeStart: values.timeStart,
            timeEnd: values.timeEnd,
            title: values.title,
            organizer: values.organizer,
            contact: values.contact,
            personalDataConsent: values.consent,
        });
    },

    async removeBooking(id: string): Promise<void> {
        await client.hallBookingDelete({ id: BigInt(id) });
    },
    async updateStatus(id: string, status: "approved" | "rejected", reviewComment = ""): Promise<void> {
        await client.hallBookingStatusUpdate({ id: BigInt(id), status: status === "approved" ? HallBookingStatus.APPROVED : HallBookingStatus.REJECTED, reviewComment });
    },
};
