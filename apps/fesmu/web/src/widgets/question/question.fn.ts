import { useState } from "react";
import type { MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { toast } from "sonner";
import type { Analytic } from "@dvgmu/analytics/entity/analytic.entity_pb";
import type { AnalyticRatingCreateRequestSchema } from "@dvgmu/analytics/service/analytic.service_pb";
import { QuestionnaireService } from "@dvgmu/fesmu/service/v1/questionnaire.service_pb";
import { connectTransport } from "@/shared/config/api";

/* Анкета по QR без входа — через открытый QuestionnaireService api fesmu:
 * опрос приходит без чужих ответов, ответ уходит в сервис аналитики с IP
 * респондента (повтор с того же устройства сервис отклоняет). */
const client = createClient(QuestionnaireService, connectTransport);

export type QuestionLookup = { by: "qr" | "id"; value: bigint };
export type QuestionPayload = MessageInitShape<typeof AnalyticRatingCreateRequestSchema>;

export const useQuestionnaire = () => {
    const [analytic, setAnalytic] = useState<Analytic | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const fetch = async (lookup: QuestionLookup) => {
        setLoading(true);
        setError(false);
        try {
            const res = await client.questionnaireFetch(lookup.by === "qr" ? { qr: lookup.value } : { id: lookup.value });
            setAnalytic(res.analytic ?? null);
        } catch (e) {
            console.error("Опрос не загружен:", e);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const submit = async (payload: QuestionPayload) => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await client.questionnaireSubmit(payload);
            if (!res.success) throw new Error(res.message || "Сервер отклонил ответы");
            setSubmitted(true);
        } catch (e) {
            console.error("Ошибка отправки опроса:", e);
            const message =
                e instanceof ConnectError && e.code === Code.ResourceExhausted
                    ? "С этого устройства уже отправлен ответ по этому опросу. Повторно можно будет позже."
                    : "Не удалось отправить ответы. Попробуйте ещё раз.";
            setSubmitError(message);
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return { analytic, loading, error, fetch, submit, submitting, submitError, submitted };
};
