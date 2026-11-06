import { useEffect, useMemo, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCommonModal } from "@/shared/components/modal";
import { exportDocTable } from "@/shared/lib/word-export";
import { testSessionApi } from "./test-session.api";
import type { TestSessionApi } from "./test-session.api";
import { attemptDay, attemptGrade, attemptPercent, emptyTestSessionForm, formatDay, sessionOpen, testSessionSchema, TestAttemptStatus } from "./test-session.schema";
import type { TestAttempt, TestSession, TestSessionForm, TestSessionResults } from "./test-session.schema";

const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

/** The server's own wording without ConnectError's code prefix. */
const errorText = (error: unknown, fallback: string) =>
    error instanceof ConnectError ? error.rawMessage || fallback : fallback;

/** Questions per attempt suggested for a large test. */
const DEFAULT_ASKED = 30;

/** Answers shown per question of a V2 test, suggested. */
const DEFAULT_OPTIONS = 5;

/** The test a session is being made from. */
export interface TestSessionTarget {
    id: string;
    topic: string;
    questionCount: number;
    /** A V2 test: right and wrong answers are mixed per student. */
    mixed: boolean;
}

/** "Hand out a test": the form, then the link to give the students. */
const useTestSessionCreate = (api: TestSessionApi = testSessionApi, exam = false) => {
    const modal = useCommonModal();
    const [target, setTarget] = useState<TestSessionTarget>();
    const [created, setCreated] = useState<TestSession>();
    const form = useForm<TestSessionForm>({
        resolver: zodResolver(testSessionSchema),
        defaultValues: emptyTestSessionForm(),
    });

    const open = (test: TestSessionTarget) => {
        setTarget(test);
        setCreated(undefined);
        // Each student gets their own random set from the test: by default up
        // to DEFAULT_ASKED of its questions (all when the test is that small).
        form.reset({
            ...emptyTestSessionForm(),
            questionCount: test.questionCount > DEFAULT_ASKED ? String(DEFAULT_ASKED) : "",
            optionCount: test.mixed ? String(DEFAULT_OPTIONS) : "",
        });
        modal.openModal("create");
    };

    const handleSubmit = form.handleSubmit(async (values) => {
        if (!target) return;
        const count = Number(values.questionCount || 0);
        if (count > target.questionCount) {
            form.setError("questionCount", { message: `В тесте всего ${target.questionCount}` });
            return;
        }
        try {
            setCreated(await api.create(target.id, target.mixed ? values : { ...values, optionCount: "" }));
            toast.success("Сессия создана — отправьте ссылку студентам");
        } catch (error) {
            console.error("Ошибка при создании сессии:", error);
            toast.error(errorText(error, "Не удалось создать сессию"));
        }
    });

    return { modal, target, created, form, open, handleSubmit, exam };
};

/** Staff list of every session: open/close the link, delete. */
const useTestSessions = (api: TestSessionApi = testSessionApi, exam = false) => {
    const [sessions, setSessions] = useState<TestSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [search, setSearch] = useState("");
    const [onlyOpen, setOnlyOpen] = useState(false);

    const fetch = async () => {
        setLoading(true);
        setError(false);
        try {
            setSessions(await api.fetch());
        } catch (err) {
            console.error("Ошибка при получении сессий:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const setOpen = async (session: TestSession, isOpen: boolean) => {
        const patch = (value: boolean) =>
            setSessions((current) => current.map((item) => (item.id === session.id ? { ...item, isOpen: value } : item)));
        patch(isOpen);
        try {
            await api.setOpen(session.id, isOpen);
            toast.success(isOpen ? "Приём ответов открыт" : "Приём ответов закрыт");
        } catch (err) {
            patch(session.isOpen);
            console.error("Ошибка при смене статуса сессии:", err);
            toast.error(errorText(err, "Не удалось изменить сессию"));
        }
    };

    const remove = async (session: TestSession) => {
        const results = session.attemptCount ? ` и ${session.attemptCount} результатов` : "";
        if (!confirm(`Удалить сессию «${session.topic}»${results}?`)) return;
        try {
            await api.remove(session.id);
            toast.success("Сессия удалена");
            setSessions((current) => current.filter((item) => item.id !== session.id));
        } catch (err) {
            console.error("Ошибка при удалении сессии:", err);
            toast.error(errorText(err, "Не удалось удалить сессию"));
        }
    };

    const visible = useMemo(() => {
        const query = search.trim().toLocaleLowerCase("ru");
        return sessions
            .filter((session) => !onlyOpen || sessionOpen(session))
            .filter(
                (session) =>
                    !query ||
                    session.topic.toLocaleLowerCase("ru").includes(query) ||
                    (session.note ?? "").toLocaleLowerCase("ru").includes(query),
            );
    }, [sessions, search, onlyOpen]);

    return { fetch, loading, error, empty: sessions.length === 0, visible, search, setSearch, onlyOpen, setOnlyOpen, setOpen, remove, exam };
};

const REFRESH_MS = 20_000;

/** One session's results; refreshed every 20 s while someone is still taking it. */
const useTestSessionResults = (sessionId: string | undefined, api: TestSessionApi = testSessionApi, exam = false) => {
    const [results, setResults] = useState<TestSessionResults>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [search, setSearch] = useState("");

    const fetch = async (quiet = false) => {
        if (!sessionId) return;
        if (!quiet) setLoading(true);
        setError(false);
        try {
            setResults(await api.results(sessionId));
        } catch (err) {
            console.error("Ошибка при получении результатов:", err);
            if (!quiet) setError(true);
        } finally {
            if (!quiet) setLoading(false);
        }
    };

    const running = results?.attempts.some((attempt) => attempt.status === TestAttemptStatus.IN_PROGRESS) ?? false;
    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => fetch(true), REFRESH_MS);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, sessionId]);

    const setOpen = async (isOpen: boolean) => {
        if (!results) return;
        try {
            await api.setOpen(results.session.id, isOpen);
            setResults({ ...results, session: { ...results.session, isOpen } });
            toast.success(isOpen ? "Приём ответов открыт" : "Приём ответов закрыт");
        } catch (err) {
            console.error("Ошибка при смене статуса сессии:", err);
            toast.error(errorText(err, "Не удалось изменить сессию"));
        }
    };

    const removeAttempt = async (attempt: TestAttempt) => {
        if (!confirm(`Удалить результат «${attempt.fullName}»? Студент сможет пройти тест заново.`)) return;
        try {
            await api.removeAttempt(attempt.id);
            toast.success("Результат удалён");
            await fetch(true);
        } catch (err) {
            console.error("Ошибка при удалении результата:", err);
            toast.error(errorText(err, "Не удалось удалить результат"));
        }
    };

    const attempts = useMemo(() => {
        const query = search.trim().toLocaleLowerCase("ru");
        const list = results?.attempts ?? [];
        return query
            ? list.filter(
                  (attempt) =>
                      attempt.fullName.toLocaleLowerCase("ru").includes(query) || attempt.studentGroup.toLocaleLowerCase("ru").includes(query),
              )
            : list;
    }, [results, search]);

    const stats = useMemo(() => {
        const list = results?.attempts ?? [];
        const done = list.filter((attempt) => attempt.status !== TestAttemptStatus.IN_PROGRESS && attempt.total > 0);
        const average = done.length ? done.reduce((sum, attempt) => sum + attempt.score / attempt.total, 0) / done.length : undefined;
        const running = list.filter((attempt) => attempt.status === TestAttemptStatus.IN_PROGRESS).length;
        return { total: list.length, done: done.length, running, average };
    }, [results]);

    return { results, attempts, stats, loading, error, fetch, search, setSearch, setOpen, removeAttempt, exam };
};

export { useTestSessionCreate, useTestSessions, useTestSessionResults };

/** The grade sheet: pick the days, then the students (all of the chosen
 * days by default), and save it as a Word file. In-progress attempts are left out. */
const useTestSessionSheet = (results: TestSessionResults | undefined) => {
    const modal = useCommonModal();
    const [days, setDays] = useState<Set<string>>(new Set());
    // Attempts unticked by hand; everything else on the chosen days goes in.
    const [excluded, setExcluded] = useState<Set<string>>(new Set());
    const [exporting, setExporting] = useState(false);

    const finished = useMemo(
        () =>
            (results?.attempts ?? [])
                .filter((attempt) => attempt.status !== TestAttemptStatus.IN_PROGRESS)
                .sort(
                    (a, b) =>
                        collator.compare(a.studentGroup, b.studentGroup) ||
                        collator.compare(a.fullName, b.fullName) ||
                        (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0),
                ),
        [results],
    );

    const dayOptions = useMemo(() => {
        const counts = new Map<string, number>();
        for (const attempt of finished) counts.set(attemptDay(attempt), (counts.get(attemptDay(attempt)) ?? 0) + 1);
        return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }));
    }, [finished]);

    const open = () => {
        setDays(new Set(dayOptions.map((option) => option.day)));
        setExcluded(new Set());
        modal.openModal("view");
    };

    const toggleDay = (day: string) =>
        setDays((prev) => {
            const next = new Set(prev);
            if (next.has(day)) next.delete(day);
            else next.add(day);
            return next;
        });

    const toggleAttempt = (id: string) =>
        setExcluded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const onDays = finished.filter((attempt) => days.has(attemptDay(attempt)));
    const selected = onDays.filter((attempt) => !excluded.has(attempt.id));

    const setAll = (checked: boolean) => setExcluded(checked ? new Set() : new Set(onDays.map((attempt) => attempt.id)));

    const download = async () => {
        if (!results || selected.length === 0) return;
        setExporting(true);
        try {
            const session = results.session;
            const chosenDays = [...days].sort().map(formatDay).join(", ");
            await exportDocTable({
                title: "Ведомость результатов тестирования",
                subtitle: [
                    `Тест: ${session.topic}`,
                    ...(session.department ? [`Кафедра: ${session.department}`] : []),
                    ...(session.note ? [`Комментарий: ${session.note}`] : []),
                    `Дата тестирования: ${chosenDays}`,
                ],
                fileName: `Ведомость ${session.topic} ${chosenDays}`.replace(/[\\/:*?"<>|]+/g, " ").trim(),
                columns: [
                    { header: "Группа", width: 1.2, render: (attempt: TestAttempt) => attempt.studentGroup },
                    { header: "ФИО", width: 3, render: (attempt) => attempt.fullName },
                    { header: "Правильно", width: 1.3, render: (attempt) => `${attempt.score} из ${attempt.total}` },
                    { header: "Оценка", width: 2.2, render: (attempt) => attemptGrade(attemptPercent(attempt)) },
                    { header: "Рейтинг", width: 1.1, render: (attempt) => `${attemptPercent(attempt)}%` },
                ],
                rows: selected,
            });
            modal.closeModal();
        } catch (err) {
            console.error("Ошибка при выгрузке ведомости:", err);
            toast.error("Не удалось сформировать ведомость");
        } finally {
            setExporting(false);
        }
    };

    return { modal, open, dayOptions, days, toggleDay, onDays, excluded, toggleAttempt, setAll, selected, download, exporting, hasFinished: finished.length > 0 };
};

export { useTestSessionSheet };
