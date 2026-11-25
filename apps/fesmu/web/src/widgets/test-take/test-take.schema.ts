import { z } from "zod";
import { TestAttemptStatus } from "@fesmu/contract/fesmu/enum/v1/test.enum_pb";

export { TestAttemptStatus };

/** The session as shown before starting. */
export interface TestTakeInfo {
 instructionRequired?:boolean;
 instruction?:string;
    topic: string;
    description?: string;
    durationMinutes: number;
    questionCount: number;
    isOpen: boolean;
    opensAt?: Date;
    closesAt?: Date;
}

export interface TestTakeQuestion {
    id: string;
    text: string;
    /** Several options are correct: checkboxes instead of radio buttons. */
    multiple: boolean;
    /** The question's picture and its size in pixels, if it has one. */
    image?: { hash: string; width: number; height: number };
    answers: { id: string; text: string }[];
}

export interface TestTakeState {
    attemptToken: string;
    topic: string;
    fullName: string;
    status: TestAttemptStatus;
    /** Server time, ms. */
    deadline: number;
    /** Server clock minus the student's, ms. */
    clockOffset: number;
    questions: TestTakeQuestion[];
    /** Option ids picked per question id. */
    picked: Record<string, string[]>;
    showResult: boolean;
    score: number;
    total: number;
}

export const testTakeStartSchema = z.object({
 recordBook:z.string(),
    fullName: z.string().trim().min(1, "Укажите ФИО").max(255, "Не длиннее 255 символов"),
    studentGroup: z.string().trim().min(1, "Укажите группу").max(64, "Не длиннее 64 символов"),
});

export const examTestTakeStartSchema=testTakeStartSchema.extend({fullName:z.string(),studentGroup:z.string(),recordBook:z.string().trim().regex(/^[0-9]{7}$/, "Введите 7 цифр номера зачётной книжки")});

export type TestTakeStartForm = z.infer<typeof testTakeStartSchema>;
