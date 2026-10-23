import { useEffect, useRef, useState } from "react";
import { Code, ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { testTakeApi } from "./test-take.api";
import { TestAttemptStatus, testTakeStartSchema } from "./test-take.schema";
import type { TestTakeInfo, TestTakeStartForm, TestTakeState } from "./test-take.schema";

export type TestTakePhase = "loading" | "missing" | "intro" | "running" | "done";

const errorText = (error: unknown, fallback: string) =>
    error instanceof ConnectError ? error.rawMessage || fallback : fallback;

const codeOf = (error: unknown) => (error instanceof ConnectError ? error.code : undefined);

// The attempt's key stays in the browser, so a reload carries on with the
// same attempt instead of starting a new one. Storage may be blocked.
const storageKey = (token: string) => `test-take:${token}`;
const savedAttempt = (token: string) => {
    try {
        return localStorage.getItem(storageKey(token)) ?? undefined;
    } catch {
        return undefined;
    }
};
const saveAttempt = (token: string, attemptToken?: string) => {
    try {
        if (attemptToken) localStorage.setItem(storageKey(token), attemptToken);
        else localStorage.removeItem(storageKey(token));
    } catch {
        // Without storage a reload starts over; the server keeps the attempt anyway.
    }
};

const phaseOf = (state: TestTakeState): TestTakePhase => (state.status === TestAttemptStatus.IN_PROGRESS ? "running" : "done");

/** A student taking a test by its session link: the intro form, the timed
 * questions (every pick is saved on the server at once) and the result. */
const useTestTake = (token: string) => {
    const [phase, setPhase] = useState<TestTakePhase>("loading");
    const [info, setInfo] = useState<TestTakeInfo>();
    const [state, setState] = useState<TestTakeState>();
    const [current, setCurrent] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [finishing, setFinishing] = useState(false);
    // Questions whose latest pick hasn't reached the server yet (shown on the page).
    const [unsaved, setUnsaved] = useState<Set<string>>(new Set());
    const pickedRef = useRef<Record<string, string[]>>({});
    const savesRef = useRef(new Map<string, Promise<void>>());
    // Picks the server refused for a network reason; resent on finishing.
    const failedRef = useRef(new Set<string>());

    const form = useForm<TestTakeStartForm>({
        resolver: zodResolver(testTakeStartSchema),
        defaultValues: { fullName: "", studentGroup: "" },
    });

    const apply = (next: TestTakeState) => {
        pickedRef.current = next.picked;
        setState(next);
        setPhase(phaseOf(next));
        if (next.status !== TestAttemptStatus.IN_PROGRESS) setUnsaved(new Set());
    };

    const load = async () => {
        setPhase("loading");
        const attemptToken = savedAttempt(token);
        if (attemptToken) {
            try {
                apply(await testTakeApi.state(attemptToken));
                return;
            } catch (error) {
                // A deleted attempt (staff removed the result) starts over.
                if (codeOf(error) !== Code.NotFound) {
                    toast.error(errorText(error, "Не удалось загрузить тест"));
                }
                saveAttempt(token, undefined);
            }
        }
        try {
            setInfo(await testTakeApi.info(token));
            setPhase("intro");
        } catch (error) {
            if (codeOf(error) !== Code.NotFound) console.error("Ошибка при загрузке теста:", error);
            setPhase("missing");
        }
    };

    const onStart = async (values: TestTakeStartForm) => {
        try {
            const next = await testTakeApi.start(token, values.fullName, values.studentGroup);
            saveAttempt(token, next.attemptToken);
            setCurrent(0);
            apply(next);
        } catch (error) {
            toast.error(errorText(error, "Не удалось начать тест"));
            if (codeOf(error) === Code.FailedPrecondition) setInfo((prev) => (prev ? { ...prev, isOpen: false } : prev));
        }
    };
    const start = (event?: React.BaseSyntheticEvent) => form.handleSubmit(onStart)(event);

    /** Time is up on the server: fetch the attempt as it ended. */
    const refresh = async () => {
        if (!state) return;
        try {
            apply(await testTakeApi.state(state.attemptToken));
        } catch (error) {
            toast.error(errorText(error, "Не удалось обновить тест"));
        }
    };

    const send = (questionId: string) => {
        if (!state) return Promise.resolve();
        const picked = pickedRef.current[questionId] ?? [];
        const save = testTakeApi
            .answer(state.attemptToken, questionId, picked)
            .then(() => {
                // A newer pick may have been sent meanwhile; only the last one clears the mark.
                if (savesRef.current.get(questionId) === save) {
                    savesRef.current.delete(questionId);
                    failedRef.current.delete(questionId);
                    setUnsaved((prev) => {
                        const next = new Set(prev);
                        next.delete(questionId);
                        return next;
                    });
                }
            })
            .catch((error) => {
                if (savesRef.current.get(questionId) === save) savesRef.current.delete(questionId);
                if (codeOf(error) === Code.FailedPrecondition) {
                    refresh();
                    return;
                }
                failedRef.current.add(questionId);
                toast.error(errorText(error, "Ответ не сохранён — проверьте подключение к интернету"));
            });
        savesRef.current.set(questionId, save);
        return save;
    };

    /** Radio: the option replaces the pick; checkbox: the option toggles. */
    const pick = (questionId: string, answerId: string) => {
        if (!state || phase !== "running") return;
        const question = state.questions.find((item) => item.id === questionId);
        if (!question) return;
        const was = pickedRef.current[questionId] ?? [];
        const next = question.multiple ? (was.includes(answerId) ? was.filter((id) => id !== answerId) : [...was, answerId]) : [answerId];
        pickedRef.current = { ...pickedRef.current, [questionId]: next };
        const picked = pickedRef.current;
        setState((prev) => prev && { ...prev, picked });
        setUnsaved((prev) => new Set(prev).add(questionId));
        send(questionId);
    };

    const finish = async () => {
        if (!state) return;
        setFinishing(true);
        try {
            await Promise.all(savesRef.current.values());
            // Resend whatever failed to reach the server.
            await Promise.all([...failedRef.current].map(send));
            apply(await testTakeApi.finish(state.attemptToken));
        } catch (error) {
            toast.error(errorText(error, "Не удалось завершить тест — попробуйте ещё раз"));
        } finally {
            setFinishing(false);
        }
    };

    const confirmFinish = () => {
        if (!state) return;
        const left = state.questions.filter((question) => !(state.picked[question.id]?.length)).length;
        const ask = left ? `Без ответа осталось вопросов: ${left}. Завершить тест?` : "Завершить тест? Изменить ответы будет нельзя.";
        if (!finishing && confirm(ask)) finish();
    };

    const running = phase === "running";
    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [running]);

    // The deadline on the student's clock.
    const deadline = state ? state.deadline - state.clockOffset : undefined;
    const remainingMs = deadline === undefined ? 0 : Math.max(0, deadline - now);

    // Time is up: hand in what has been saved. The server would grade it on
    // its own anyway; this just shows the result without a reload.
    useEffect(() => {
        if (!running || deadline === undefined) return;
        const timer = setTimeout(() => finish(), Math.max(0, deadline - Date.now()));
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, deadline]);

    const answered = state ? state.questions.filter((question) => state.picked[question.id]?.length).length : 0;

    return {
        load,
        phase,
        info,
        state,
        form,
        start,
        pick,
        current,
        setCurrent,
        remainingMs,
        answered,
        unsaved,
        finishing,
        confirmFinish,
    };
};

export { useTestTake };
