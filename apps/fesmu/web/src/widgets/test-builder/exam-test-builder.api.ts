import { createClient } from "@connectrpc/connect";
import type { Test as TestMessage } from "@fesmu/contract/fesmu/entity/v1/test.entity_pb";
import { ExamTestService } from "@fesmu/contract/fesmu/exam/service/v1/exam_test.service_pb";
import { connectTransport } from "@/shared/config/api";
import { TestVersion } from "./test-builder.schema";
import type { Test, TestForm, TestImage } from "./test-builder.schema";
import type { TestBuilderApi } from "./test-builder.api";

/** A supplied .docx or .txt read into a draft for the create form. */
export interface TestImportDraft {
    form: TestForm;
    warnings: string[];
}

const client = createClient(ExamTestService, connectTransport);

const fromMessage = (message: TestMessage): Test => ({
    id: message.id.toString(),
    department: message.department,
    discipline: message.discipline,
    semester: message.semester,
    topic: message.topic,
    description: message.description || undefined,
    version: message.version === TestVersion.V2 ? TestVersion.V2 : TestVersion.V1,
    questions: message.questions.map((question) => ({
        id: question.id.toString(),
        text: question.text,
        image: question.image ? { hash: question.image, width: question.imageWidth, height: question.imageHeight } : undefined,
        answers: question.answers.map((answer) => ({
            id: answer.id.toString(),
            text: answer.text,
            isCorrect: answer.isCorrect,
        })),
    })),
});

/** The only place the widget talks to the test service. */
export const examTestBuilderApi: TestBuilderApi = {
    async fetch(): Promise<Test[]> {
        const response = await client.testFetch({});
        return response.list.map(fromMessage);
    },

    async create(values: TestForm): Promise<void> {
        await client.testCreate({ ...values, semester: Number(values.semester) });
    },

    async update(id: string, values: TestForm): Promise<void> {
        await client.testUpdate({ id: BigInt(id), ...values, semester: Number(values.semester) });
    },

    async remove(id: string): Promise<void> {
        await client.testDelete({ id: BigInt(id) });
    },

    /** The test as an .rtf in the testing system's template format. */
    async export(id: string): Promise<{ fileName: string; content: Uint8Array }> {
        const response = await client.testExport({ id: BigInt(id) });
        return { fileName: response.fileName, content: response.content };
    },

    /** Stores a question's picture (JPEG or PNG, up to 5 MB); the same file gives the same id. */
    async uploadImage(file: File): Promise<TestImage> {
        const response = await client.testImageUpload({ content: new Uint8Array(await file.arrayBuffer()) });
        return { hash: response.image, width: response.width, height: response.height };
    },

    /** Reads a .docx or .txt (question, options, "@" before the correct ones); saves nothing. */
    async importParse(file: File): Promise<TestImportDraft> {
        const response = await client.testImportParse({
            fileName: file.name,
            content: new Uint8Array(await file.arrayBuffer()),
        });
        return {
            form: {
                department: "",
                discipline: "",
                semester: "",
                topic: response.topic,
                description: "",
                version: TestVersion.V1,
                questions: response.questions.map((question) => ({
                    text: question.text,
                    image: question.image,
                    answers: question.answers.map((answer) => ({ text: answer.text, isCorrect: answer.isCorrect })),
                })),
            },
            warnings: response.warnings,
        };
    },
};
