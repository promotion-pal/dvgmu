import { createClient } from "@connectrpc/connect";
import { ScheduleCollectService } from "@fesmu/contract/fesmu/service/v1/schedule_collect.service_pb";
import type { ScheduleCollectEntry as ScheduleCollectEntryMessage } from "@fesmu/contract/fesmu/entity/v1/schedule_collect.entity_pb";
import { connectTransport } from "@/shared/config/api";
import type { ScheduleCollectEntry, ScheduleCollectEntryInput } from "./schedule-collect.schema";

const client = createClient(ScheduleCollectService, connectTransport);

/** Position and last/first/middle name are separate fields in the form but
 * one column (Name / Substitution_Name) in the exchange format. */
const joinName = (position: string, lastName: string, firstName: string, middleName: string) =>
    [position, lastName, firstName, middleName]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" ");

/** The exchange format's Day column (1 = Monday .. 7 = Sunday), derived from
 * Date instead of asked for separately — parsed as UTC so the local
 * timezone can't shift it onto the neighbouring day. */
const dayFromDate = (date: string): number => {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return 1;
    const [, year, month, day] = match;
    const utcDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
    return utcDay === 0 ? 7 : utcDay;
};

/** StudInLesson, Week, Subg, PrepID, CafID and Subj_CafID (and the
 * matching Substitution_* pair) are part of the exchange format but not
 * collected on this page — they go out empty/zero and are filled in
 * downstream. */
const toMessage = (input: ScheduleCollectEntryInput) => ({
    group: input.group,
    studInLesson: 0,
    day: dayFromDate(input.date),
    les: input.les,
    aud: input.aud,
    week: 0,
    subg: 0,
    name: joinName(input.namePosition, input.nameLastName, input.nameFirstName, input.nameMiddleName ?? ""),
    cafId: "",
    subject: input.subject,
    subjType: input.subjType,
    date: input.date,
    subjCafId: "",
    prepId: "",
    themas: input.themas ?? "",
    substitutionName: joinName(
        input.substitutionPosition ?? "",
        input.substitutionLastName ?? "",
        input.substitutionFirstName ?? "",
        input.substitutionMiddleName ?? "",
    ),
    substitutionPrepId: "",
    substitutionSubject: input.substitutionSubject ?? "",
    substitutionSubjType: input.substitutionSubjType ?? "",
    substitutionSubjCafId: "",
    substitutionThemas: input.substitutionThemas ?? "",
});

const fromMessage = (message: ScheduleCollectEntryMessage): ScheduleCollectEntry => ({
    id: message.id,
    group: message.group,
    studInLesson: message.studInLesson,
    day: message.day,
    les: message.les,
    aud: message.aud,
    week: message.week,
    subg: message.subg,
    name: message.name,
    cafId: message.cafId,
    subject: message.subject,
    subjType: message.subjType,
    date: message.date,
    subjCafId: message.subjCafId,
    prepId: message.prepId,
    themas: message.themas,
    substitutionName: message.substitutionName,
    substitutionPrepId: message.substitutionPrepId,
    substitutionSubject: message.substitutionSubject,
    substitutionSubjType: message.substitutionSubjType,
    substitutionSubjCafId: message.substitutionSubjCafId,
    substitutionThemas: message.substitutionThemas,
    createdAt: message.createdAt ? new Date(Number(message.createdAt.seconds) * 1000).toISOString() : "",
});

/** The only place the widget talks to the schedule-collect service. The
 * server never fails a submission with a transport error for a validation
 * problem — it answers success=false with a reason — so that case is
 * turned into a thrown error here, same as a transport failure would be. */
export const scheduleCollectApi = {
    async fetch(offset: number, signal: AbortSignal) {
        const response = await client.scheduleCollectFetch({ offset }, { signal });
        return { items: response.items.map(fromMessage), hasMore: response.hasMore };
    },
    async create(input: ScheduleCollectEntryInput): Promise<ScheduleCollectEntry> {
        const response = await client.scheduleCollectCreate({ item: toMessage(input) });
        if (!response.success || !response.item) {
            throw new Error(response.message || "Не удалось сохранить запись");
        }
        return fromMessage(response.item);
    },
};
