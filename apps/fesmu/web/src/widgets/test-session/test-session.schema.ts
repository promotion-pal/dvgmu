import { z } from "zod";
import { TestAttemptStatus, TestVersion } from "@fesmu/contract/fesmu/enum/v1/test.enum_pb";

export { TestVersion };
import { ROUTE } from "@/shared/config/path";

export { TestAttemptStatus };

/** A test handed out to students by a link, with a time limit per attempt. */
export interface TestSession {
    id: string;
    assignedCount?: number;
    audience?: {kind:string;facultyCode:number;course:number;studentGroup:string;studentUuids:string[]};
    /** Undefined once the test itself was deleted; the session keeps its copy. */
    testId?: string;
    token: string;
    topic: string;
    department: string;
    note?: string;
    durationMinutes: number;
    /** Questions per attempt; 0 = all. */
    questionCount: number;
    /** Options shown per question, a random mix of right and wrong; 0 = all. */
    optionCount: number;
    /** Made from a V2 test: right and wrong answers mixed per student. */
    mixed: boolean;
    totalQuestions: number;
    shuffle: boolean;
    showResult: boolean;
    isOpen: boolean;
    opensAt?: Date;
    closesAt?: Date;
    attemptCount: number;
    createdAt?: Date;
}

export interface TestSessionQuestion {
    id: string;
    text: string;
    answers: { id: string; text: string; isCorrect: boolean }[];
}

export interface TestAttempt {
    id: string;
    mdmUserUuid?:string;
    fullName: string;
    studentGroup: string;
    status: TestAttemptStatus;
    score: number;
    total: number;
    startedAt?: Date;
    deadline?: Date;
    finishedAt?: Date;
    /** Every question asked, in order; answerIds is empty when unanswered. */
    answers: { questionId: string; answerIds: string[]; isCorrect: boolean }[];
}

export interface TestSessionResults {
    session: TestSession;
    questions: TestSessionQuestion[];
    attempts: TestAttempt[];
}

export const ATTEMPT_STATUS_LABEL: Record<TestAttemptStatus, string> = {
    [TestAttemptStatus.UNSPECIFIED]: "—",
    [TestAttemptStatus.IN_PROGRESS]: "Проходит",
    [TestAttemptStatus.FINISHED]: "Завершён",
    [TestAttemptStatus.EXPIRED]: "Время вышло",
};

export const ATTEMPT_STATUS_TONE: Record<TestAttemptStatus, string> = {
    [TestAttemptStatus.UNSPECIFIED]: "bg-muted-foreground/50",
    [TestAttemptStatus.IN_PROGRESS]: "bg-sky-500",
    [TestAttemptStatus.FINISHED]: "bg-emerald-500",
    [TestAttemptStatus.EXPIRED]: "bg-amber-500",
};

/** The student link of a session. */
export const testTakeUrl = (token: string, exam = false) =>
    `${window.location.origin}${exam ? ROUTE.PUBLIC.EXAM_TESTING : ROUTE.PUBLIC.TEST_TAKE.replace(":token", token)}`;

/** The opening time is still ahead. */
export const sessionNotOpenYet = (session: TestSession, now = new Date()) => Boolean(session.opensAt && session.opensAt > now);

/** Open for new attempts: opened, not closed by hand and not past its close date. */
export const sessionOpen = (session: TestSession, now = new Date()) =>
    session.isOpen && !sessionNotOpenYet(session, now) && (!session.closesAt || session.closesAt > now);

const wholeNumber = z.string().trim().regex(/^\d*$/, "Только цифры");

/** The "hand out a test" form; the server checks the same rules. */
export const testSessionSchema = z.object({
    audience: z.object({
        kind: z.enum(["", "course", "group", "students"]),
        facultyCode: z.string(), course: z.string(), studentGroup: z.string(),
        studentUuids: z.array(z.string()),
    }),
    durationMinutes: wholeNumber
        .min(1, "Укажите время на прохождение")
        .refine((value) => Number(value) >= 1 && Number(value) <= 600, "От 1 до 600 минут"),
    /** Empty = every question. */
    questionCount: wholeNumber,
    /** V2 tests: answers shown per question, a random mix; empty = all. */
    optionCount: wholeNumber.refine((value) => !value || (Number(value) >= 2 && Number(value) <= 30), "От 2 до 30 (пусто — все)"),
    shuffle: z.boolean(),
    showResult: z.boolean(),
    note: z.string().trim().max(255, "Не длиннее 255 символов"),
    /** A datetime-local value; empty = open right away. */
    opensAt: z.string(),
    /** A datetime-local value; empty = open until closed by hand. */
    closesAt: z.string().refine((value) => !value || new Date(value) > new Date(), "Дата закрытия уже прошла"),
}).refine((values) => !values.opensAt || !values.closesAt || new Date(values.closesAt) > new Date(values.opensAt), {
    path: ["closesAt"],
    message: "Закрытие должно быть позже открытия",
});

export type TestSessionForm = z.infer<typeof testSessionSchema>;

export const emptyTestSessionForm = (): TestSessionForm => ({
    audience: {kind:"",facultyCode:"",course:"",studentGroup:"",studentUuids:[]},
 durationMinutes: "30",
    questionCount: "",
    optionCount: "",
    shuffle: true,
    showResult: false,
    note: "",
    opensAt: "",
    closesAt: "",
});

/** Share of right answers, 0–100. */
export const attemptPercent = (attempt: Pick<TestAttempt, "score" | "total">) =>
    attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;

/** The usual scale for computer testing: 91–100% — «отлично», 81–90 —
 * «хорошо», 71–80 — «удовлетворительно», below — «неудовлетворительно». */
export const attemptGrade = (percent: number) =>
    percent >= 91 ? "5 (отлично)" : percent >= 81 ? "4 (хорошо)" : percent >= 71 ? "3 (удовлетворительно)" : "2 (неудовлетворительно)";

/** The local calendar day an attempt was started on, "2026-10-05". */
export const attemptDay = (attempt: TestAttempt) => {
    const date = attempt.startedAt;
    if (!date) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const formatDay = (day: string) => (day ? new Date(`${day}T00:00:00`).toLocaleDateString("ru-RU") : "без даты");
