import { EMPTY_SCHEDULE_COLLECT_ENTRY, scheduleCollectEntrySchema, SUBJ_TYPE_OPTIONS } from "./schedule-collect.schema.ts";
import type { ScheduleCollectEntryInput } from "./schedule-collect.schema.ts";

const columns = ["Дата", "Группа", "Пара", "Аудитория", "Должность", "Фамилия", "Имя", "Дисциплина", "Вид"] as const;
export const scheduleCollectTableHeader = columns.join("\t");
export const maxScheduleCollectTableSize = 512 * 1024;

function tableRecords(text: string, delimiter: string) {
    const records: { line: number; fields: string[] }[] = [];
    let fields: string[] = [];
    let cell = "";
    let line = 1;
    let startLine = 1;
    let quoted = false;
    let closed = false;

    for (let index = 0; index <= text.length; index++) {
        const char = text[index];
        if (quoted) {
            if (char === undefined) throw new Error(`Строка ${startLine}: не закрыта кавычка`);
            if (char === '"' && text[index + 1] === '"') {
                cell += '"';
                index++;
            } else if (char === '"') {
                quoted = false;
                closed = true;
            } else {
                cell += char;
                if (char === "\n") line++;
            }
        } else if (char === delimiter || char === "\r" || char === "\n" || char === undefined) {
            fields.push(cell.trim());
            cell = "";
            closed = false;
            if (char === delimiter) continue;
            if (fields.some(Boolean)) records.push({ line: startLine, fields });
            fields = [];
            if (char === "\r" && text[index + 1] === "\n") index++;
            startLine = ++line;
        } else if (char === '"' && !cell && !closed) {
            quoted = true;
        } else {
            if (closed || char === '"') throw new Error(`Строка ${startLine}: проверьте кавычки в полях`);
            cell += char;
        }
    }
    return records;
}

export function parseScheduleCollectTable(input: string, availableRows: number): ScheduleCollectEntryInput[] {
    if (input.length > maxScheduleCollectTableSize || new TextEncoder().encode(input).length > maxScheduleCollectTableSize) {
        throw new Error("Таблица превышает 512 КБ");
    }
    const text = input.replace(/^\uFEFF/, "");
    const header = text.split(/\r\n|\n|\r/).find((line) => line.trim());
    if (!header) throw new Error("Добавьте заголовок и хотя бы одну строку");
    const delimiter = ["\t", ";", ","].find((separator) => header.includes(separator)) ?? "\t";
    const [heading, ...records] = tableRecords(text, delimiter);
    const index = heading?.fields ?? [];
    if (index.length !== columns.length || columns.some((column) => !index.includes(column))) {
        throw new Error("Сверьте названия девяти столбцов с заголовком образца");
    }
    if (records.length === 0) throw new Error("В таблице нет строк с занятиями");
    if (records.length > availableRows) throw new Error(`В пакет можно добавить ещё строк: ${availableRows}`);

    return records.map(({ line, fields }) => {
        if (fields.length !== columns.length) throw new Error(`Строка ${line}: ожидалось девять столбцов`);
        const col = (name: typeof columns[number]) => fields[index.indexOf(name)];
        const date = col("Дата");
        const day = new Date(date + "T00:00:00Z");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(+day) || day.toISOString().slice(0, 10) !== date) {
            throw new Error(`Строка ${line}: укажите существующую дату в формате ГГГГ-ММ-ДД`);
        }
        const type = col("Вид");
        if (!SUBJ_TYPE_OPTIONS.some(({ value }) => value === type)) {
            throw new Error(`Строка ${line}: неизвестный вид занятия «${type}»`);
        }
        const parsed = scheduleCollectEntrySchema.safeParse({
            ...EMPTY_SCHEDULE_COLLECT_ENTRY,
            date,
            group: col("Группа"),
            les: col("Пара"),
            aud: col("Аудитория"),
            namePosition: col("Должность"),
            nameLastName: col("Фамилия"),
            nameFirstName: col("Имя"),
            subject: col("Дисциплина"),
            subjType: type,
        });
        if (!parsed.success) throw new Error(`Строка ${line}: ${parsed.error.issues[0].message}`);
        return parsed.data;
    });
}
