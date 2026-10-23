import { NO_DEPARTMENT, NO_DISCIPLINE, TestVersion } from "./test-builder.schema";
import type { Test } from "./test-builder.schema";

/** Tests whose topics differ only by a year prefix or a trailing number
 * ("23/24 Анатомия 01", "Анатомия-2", "Т-10-11") fall into one group. */
export interface TestGroup {
    key: string;
    title: string;
    tests: Test[];
}

const YEAR_PREFIX = /^\d{2}\/\d{2}\s+/;
const TAIL_NUMBER = /[\s\-–—_.,№]*\d+\s*$/;

const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

/** "23/24 Анатомия 01" → "Анатомия"; numbers are stripped from the end
 * until none is left ("Т-10-11" → "Т"). A topic that is only a number stays as is. */
export const topicBase = (topic: string) => {
    let base = topic.trim().replace(YEAR_PREFIX, "");
    for (let next = base.replace(TAIL_NUMBER, "").trim(); next && next !== base; next = base.replace(TAIL_NUMBER, "").trim()) {
        base = next;
    }
    return base || topic.trim();
};

const withoutYear = (topic: string) => topic.trim().replace(YEAR_PREFIX, "");

const upperFirst = (s: string) => s.charAt(0).toLocaleUpperCase("ru") + s.slice(1);

export const groupTests = (tests: Test[]): TestGroup[] => {
    const groups = new Map<string, { titles: Map<string, number>; tests: Test[] }>();
    for (const test of tests) {
        const base = topicBase(test.topic);
        const key = base.toLocaleLowerCase("ru");
        const group = groups.get(key) ?? { titles: new Map<string, number>(), tests: [] as Test[] };
        group.titles.set(base, (group.titles.get(base) ?? 0) + 1);
        group.tests.push(test);
        groups.set(key, group);
    }

    return [...groups.entries()]
        .map(([key, group]) => {
            // The spelling used most often names the group.
            const [title] = [...group.titles.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]))[0];
            return {
                key,
                title: upperFirst(title),
                tests: group.tests.sort((a, b) => collator.compare(withoutYear(a.topic), withoutYear(b.topic)) || collator.compare(a.topic, b.topic)),
            };
        })
        .sort((a, b) => collator.compare(a.title, b.title));
};

/** Tests under one discipline, by similar topic. */
export interface DisciplineSection {
    key: string;
    title: string;
    count: number;
    groups: TestGroup[];
}

/** Tests under one department, by discipline. */
export interface DepartmentSection {
    key: string;
    title: string;
    count: number;
    disciplines: DisciplineSection[];
}

const normalize = (value: string) =>
    value.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();

/** Spellings of one department typed by different people compare equal:
 * "Кафедра анатомии", "кафедра  анатомии", "Анатомии" → "анатомии". */
export const departmentKey = (department: string) => normalize(department).replace(/^кафедра\s+/, "");

/** "Анатомия  человека", "анатомия человека" → "анатомия человека". */
export const disciplineKey = (discipline: string) => normalize(discipline);

interface Bucket {
    key: string;
    title: string;
    tests: Test[];
}

/** Splits tests by a free-text field typed in by staff: spellings that give the
 * same key fall together, named by the most common spelling (on a tie the one
 * preferred by `prefer`, then alphabetically); empty values go last as `emptyTitle`. */
const bucketBy = (
    tests: Test[],
    value: (test: Test) => string,
    keyOf: (value: string) => string,
    emptyTitle: string,
    prefer: (title: string) => boolean = () => false,
): Bucket[] => {
    const byKey = new Map<string, { spellings: Map<string, { title: string; count: number }>; tests: Test[] }>();
    for (const test of tests) {
        const title = value(test).trim().replace(/\s+/g, " ");
        const key = keyOf(title);
        const bucket = byKey.get(key) ?? { spellings: new Map(), tests: [] as Test[] };
        if (title) {
            // Spellings differing only in case count together; a capitalised one is shown.
            const spelling = title.toLocaleLowerCase("ru");
            const seen = bucket.spellings.get(spelling);
            bucket.spellings.set(spelling, {
                title: seen && /^\p{Lu}/u.test(seen.title) ? seen.title : title,
                count: (seen?.count ?? 0) + 1,
            });
        }
        bucket.tests.push(test);
        byKey.set(key, bucket);
    }

    return [...byKey.entries()]
        .map(([key, bucket]) => {
            const best = [...bucket.spellings.values()].sort(
                (a, b) => b.count - a.count || Number(prefer(b.title)) - Number(prefer(a.title)) || collator.compare(a.title, b.title),
            )[0];
            return { key, title: upperFirst(best?.title ?? emptyTitle), tests: bucket.tests };
        })
        .sort((a, b) => Number(a.key === "") - Number(b.key === "") || collator.compare(a.key, b.key));
};

/** Tests by department ("Без кафедры" last), inside by discipline ("Без
 * дисциплины" last), inside by similar topic. */
export const groupByDepartment = (tests: Test[]): DepartmentSection[] =>
    bucketBy(tests, (test) => test.department, departmentKey, NO_DEPARTMENT, (title) => /^кафедра\s/i.test(title)).map((department) => ({
        key: department.key,
        title: department.title,
        count: department.tests.length,
        disciplines: bucketBy(department.tests, (test) => test.discipline, disciplineKey, NO_DISCIPLINE).map((discipline) => ({
            // Unique across departments: the accordion keeps open items by key.
            key: `${department.key}/${discipline.key}`,
            title: discipline.title,
            count: discipline.tests.length,
            groups: groupTests(discipline.tests),
        })),
    }));

/** Spellings already typed in, one per key, for the form's suggestions. */
export const suggestionsOf = (tests: Test[], value: (test: Test) => string, keyOf: (value: string) => string) =>
    bucketBy(tests, value, keyOf, "")
        .filter((bucket) => bucket.key)
        .map((bucket) => bucket.title);

/** The number after `topic` in "<topic> 12" — for numbering imported tests. */
const numberAfter = (topic: string, base: string) => {
    const match = normalize(topic).match(new RegExp(`^${normalize(base).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(\\d+)$`));
    return match ? Number(match[1]) : undefined;
};

/** The first free number for "<base> N" among existing tests: 1 when none. */
export const nextTopicNumber = (tests: Test[], base: string) => {
    if (!base.trim()) return 1;
    const taken = tests.map((test) => numberAfter(test.topic, base)).filter((n): n is number => n !== undefined);
    return taken.length ? Math.max(...taken) + 1 : 1;
};

/** File names in natural order ("Т-2" before "Т-10"), as staff number their files. */
export const byFileName = (a: File, b: File) => collator.compare(a.name, b.name);

/** What makes two questions variants of one — their letters and digits,
 * case and "ё/е" aside ("- это:", "— это:" and "это" are the same). Matches
 * QuestionKey on the server. */
export const questionKey = (text: string) =>
    (text.toLocaleLowerCase("ru").replace(/ё/g, "е").match(/[\p{L}\p{N}]+/gu) ?? []).join(" ");

/** Distinct questions: variants of one question (see questionKey) count once —
 * a session asks it once, as a random variant. */
export const distinctQuestionCount = (questions: { text: string }[]) => new Set(questions.map((question) => questionKey(question.text))).size;

/** Questions a session of the test can ask: a V1 test — every added one;
 * a V2 test — distinct ones, variants counted once. */
export const askableQuestionCount = (test: Pick<Test, "version" | "questions">) =>
    test.version === TestVersion.V2 ? distinctQuestionCount(test.questions) : test.questions.length;
