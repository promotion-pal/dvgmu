import { createClient } from "@connectrpc/connect";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type { TestAttempt as AttemptMessage, TestSession as SessionMessage } from "@fesmu/contract/fesmu/entity/v1/test.entity_pb";
import { ExamTestSessionService } from "@fesmu/contract/fesmu/exam/service/v1/exam_test_session.service_pb";
import { connectTransport } from "@/shared/config/api";
import { TestVersion } from "./test-session.schema";
import type { TestAttempt, TestSession, TestSessionForm, TestSessionResults } from "./test-session.schema";
import type { TestSessionApi } from "./test-session.api";

const client = createClient(ExamTestSessionService, connectTransport);

const toDate = (timestamp?: Timestamp) => (timestamp ? timestampDate(timestamp) : undefined);

const fromSession = (message: SessionMessage): TestSession => ({
    id: message.id.toString(),
 assignedCount:message.assignedCount,
 recipients:message.recipients.map(person=>({mdmUserUuid:person.mdmUserUuid,fullName:person.fullName,studentGroup:person.studentGroup,issuedAt:toDate(person.issuedAt)})),
 audience:message.audience,
    testId: message.testId ? message.testId.toString() : undefined,
    token: message.token,
    topic: message.topic,
    department: message.department,
    note: message.note || undefined,
    durationMinutes: message.durationMinutes,
    questionCount: message.questionCount,
    optionCount: message.optionCount,
    mixed: message.version === TestVersion.V2,
    totalQuestions: message.totalQuestions,
    shuffle: message.shuffle,
    showResult: message.showResult,
    isOpen: message.isOpen,
    opensAt: toDate(message.opensAt),
    closesAt: toDate(message.closesAt),
    attemptCount: message.attemptCount,
    createdAt: toDate(message.createdAt),
});

const fromAttempt = (message: AttemptMessage): TestAttempt => ({
 mdmUserUuid:message.mdmUserUuid||undefined,
    id: message.id.toString(),
    fullName: message.fullName,
    studentGroup: message.studentGroup,
    status: message.status,
    score: message.score,
    total: message.total,
    startedAt: toDate(message.startedAt),
    deadline: toDate(message.deadline),
    finishedAt: toDate(message.finishedAt),
    answers: message.answers.map((answer) => ({
        questionId: answer.questionId.toString(),
        answerIds: answer.answerIds.map(String),
        isCorrect: answer.isCorrect,
    })),
});

/** The only place the staff side talks to the test session service. */
export const examTestSessionApi: TestSessionApi = {
    async create(testId: string, values: TestSessionForm): Promise<TestSession> {
        const response = await client.testSessionCreate({
            testId: BigInt(testId),
 audience:{kind:values.audience.kind,facultyCode:Number(values.audience.facultyCode),course:Number(values.audience.course),studentGroup:values.audience.studentGroup,studentUuids:values.audience.studentUuids},
            durationMinutes: Number(values.durationMinutes),
            questionCount: Number(values.questionCount || 0),
            optionCount: Number(values.optionCount || 0),
            shuffle: values.shuffle,
            showResult: false,
            note: values.note,
            opensAt: values.opensAt ? timestampFromDate(new Date(values.opensAt)) : undefined,
            closesAt: values.closesAt ? timestampFromDate(new Date(values.closesAt)) : undefined,
        });
        return fromSession(response.session!);
    },

    async fetch(): Promise<TestSession[]> {
        const response = await client.testSessionFetch({});
        return response.list.map(fromSession);
    },

    async setOpen(id: string, isOpen: boolean): Promise<void> {
        await client.testSessionOpenUpdate({ id: BigInt(id), isOpen });
    },

    async remove(id: string): Promise<void> {
        await client.testSessionDelete({ id: BigInt(id) });
    },

    async results(sessionId: string): Promise<TestSessionResults> {
        const response = await client.testAttemptFetch({ sessionId: BigInt(sessionId) });
        return {
            session: fromSession(response.session!),
            questions: response.questions.map((question) => ({
                id: question.id.toString(),
                text: question.text,
                answers: question.answers.map((answer) => ({ id: answer.id.toString(), text: answer.text, isCorrect: answer.isCorrect })),
            })),
            attempts: response.list.map(fromAttempt),
        };
    },

    async removeAttempt(id: string): Promise<void> {
        await client.testAttemptDelete({ id: BigInt(id) });
    },
};
