import { z } from "zod";
import { TestVersion } from "@fesmu/contract/fesmu/enum/v1/test.enum_pb";

export { TestVersion };

/** Tests made before the department field existed. */
export const NO_DEPARTMENT = "Без кафедры";

/** Tests made before the discipline field existed. */
export const NO_DISCIPLINE = "Без дисциплины";

export interface TestAnswer {
    id: string;
    text: string;
    isCorrect: boolean;
}

/** A question's picture: its id (see testImageUrl) and size in pixels. */
export interface TestImage {
    hash: string;
    width: number;
    height: number;
}

export interface TestQuestion {
    id: string;
    text: string;
    image?: TestImage;
    answers: TestAnswer[];
}

/** A staff-built test: a topic and its questions with answer options. */
export interface Test {
    id: string;
    /** Typed in by staff; empty for tests made before the field existed. */
    department: string;
    /** Typed in by staff; empty for tests made before the field existed. */
    discipline: string;
    topic: string;
    description?: string;
    version: TestVersion;
    questions: TestQuestion[];
}

const answerSchema = z.object({
    text: z.string().trim().min(1, "Введите вариант ответа"),
    isCorrect: z.boolean(),
});

const questionSchema = z.object({
    text: z.string().trim().min(1, "Введите текст вопроса"),
    /** The picture's id; empty — none. */
    image: z.string(),
    answers: z
        .array(answerSchema)
        .min(2, "Нужно хотя бы 2 варианта ответа")
        .max(30, "Не больше 30 вариантов ответа")
        .refine((answers) => answers.some((answer) => answer.isCorrect), "Отметьте верный вариант ответа"),
});

/** The create/edit form; the server checks the same rules. */
export const testSchema = z.object({
    department: z.string().trim().min(1, "Укажите кафедру").max(255, "Не длиннее 255 символов"),
    discipline: z.string().trim().min(1, "Укажите дисциплину").max(255, "Не длиннее 255 символов"),
    topic: z.string().trim().min(1, "Укажите тему теста").max(255, "Не длиннее 255 символов"),
    description: z.string().trim().max(1024, "Не длиннее 1024 символов"),
    version: z.union([z.literal(TestVersion.V1), z.literal(TestVersion.V2)]),
    questions: z.array(questionSchema).min(1, "Добавьте хотя бы один вопрос").max(500, "Не больше 500 вопросов"),
});

export type TestForm = z.infer<typeof testSchema>;
export type TestQuestionForm = TestForm["questions"][number];

export const emptyAnswer = (): TestForm["questions"][number]["answers"][number] => ({ text: "", isCorrect: false });
export const emptyQuestion = (): TestQuestionForm => ({ text: "", image: "", answers: [{ text: "", isCorrect: true }, emptyAnswer()] });
export const emptyTestForm = (version: TestForm["version"] = TestVersion.V1): TestForm => ({
    department: "",
    discipline: "",
    topic: "",
    description: "",
    version,
    questions: [emptyQuestion()],
});

/** Bulk import: what every imported test gets. With a topic, the tests are
 * named "<topic> <start>", "<topic> <start+1>", … in file-name order;
 * without one, each keeps its file's name. */
export const bulkImportSchema = z.object({
    department: testSchema.shape.department,
    discipline: testSchema.shape.discipline,
    version: testSchema.shape.version,
    topic: z.string().trim().max(240, "Не длиннее 240 символов"),
    start: z.string().regex(/^\d{1,4}$/, "Номер — целое число"),
});

export type BulkImportForm = z.infer<typeof bulkImportSchema>;
