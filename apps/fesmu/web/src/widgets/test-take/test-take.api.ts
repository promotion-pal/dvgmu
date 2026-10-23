import { createClient } from "@connectrpc/connect";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { TestTakeStateResponse } from "@dvgmu/contract/service/v1/test_session.service_pb";
import { TestSessionService } from "@dvgmu/contract/service/v1/test_session.service_pb";
import { connectTransport } from "@/shared/config/api";
import type { TestTakeInfo, TestTakeState } from "./test-take.schema";

const client = createClient(TestSessionService, connectTransport);

const fromState = (message: TestTakeStateResponse): TestTakeState => {
    const serverTime = message.serverTime ? timestampDate(message.serverTime).getTime() : Date.now();
    return {
        attemptToken: message.attemptToken,
        topic: message.topic,
        fullName: message.fullName,
        status: message.status,
        deadline: message.deadline ? timestampDate(message.deadline).getTime() : Date.now(),
        // How far the student's clock is behind the server's.
        clockOffset: serverTime - Date.now(),
        questions: message.questions.map((question) => ({
            id: question.id.toString(),
            text: question.text,
            multiple: question.multiple,
            image: question.image ? { hash: question.image, width: question.imageWidth, height: question.imageHeight } : undefined,
            answers: question.answers.map((answer) => ({ id: answer.id.toString(), text: answer.text })),
        })),
        picked: Object.fromEntries(message.answers.map((answer) => [answer.questionId.toString(), answer.answerIds.map(String)])),
        showResult: message.showResult,
        score: message.score,
        total: message.total,
    };
};

/** The student's side of the test session service; needs no login. */
export const testTakeApi = {
    async info(token: string): Promise<TestTakeInfo> {
        const response = await client.testTakeInfo({ token });
        return {
            topic: response.topic,
            description: response.description || undefined,
            durationMinutes: response.durationMinutes,
            questionCount: response.questionCount,
            isOpen: response.isOpen,
            opensAt: response.opensAt ? timestampDate(response.opensAt) : undefined,
            closesAt: response.closesAt ? timestampDate(response.closesAt) : undefined,
        };
    },

    async start(token: string, fullName: string, studentGroup: string): Promise<TestTakeState> {
        return fromState(await client.testTakeStart({ token, fullName, studentGroup }));
    },

    async state(attemptToken: string): Promise<TestTakeState> {
        return fromState(await client.testTakeState({ attemptToken }));
    },

    async answer(attemptToken: string, questionId: string, answerIds: string[]): Promise<void> {
        await client.testTakeAnswer({ attemptToken, questionId: BigInt(questionId), answerIds: answerIds.map(BigInt) });
    },

    async finish(attemptToken: string): Promise<TestTakeState> {
        return fromState(await client.testTakeFinish({ attemptToken }));
    },
};
