import { useMemo, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { useCommonModal } from "@/shared/components/modal";
import { testBuilderApi } from "./test-builder.api";
import type { TestBuilderApi } from "./test-builder.api";
import { emptyTestForm, examTestSchema, testSchema, TestVersion } from "./test-builder.schema";
import type { Test, TestForm } from "./test-builder.schema";
import { departmentKey, disciplineKey, groupByDepartment, groupExamByDepartment, suggestionsOf } from "./test-builder.utils";
import { useBulkImport } from "./test-builder.bulk.fn";

const NO_DEPARTMENT_VALUE = "__none__";

/** The server's own wording ("вопрос 2: отметьте верный вариант ответа") without ConnectError's code prefix. */
const errorText = (error: unknown, fallback: string) =>
    error instanceof ConnectError ? error.rawMessage || fallback : fallback;

const toForm = (test: Test): TestForm => ({
    department: test.department,
    discipline: test.discipline,
    semester: String(test.semester || ""),
    topic: test.topic,
    description: test.description ?? "",
    version: test.version === TestVersion.V2 ? TestVersion.V2 : TestVersion.V1,
    questions: test.questions.map((question) => ({
        text: question.text,
        image: question.image?.hash ?? "",
        answers: question.answers.map((answer) => ({ text: answer.text, isCorrect: answer.isCorrect })),
    })),
});

const downloadFile = (fileName: string, content: Uint8Array) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(content)], { type: "application/rtf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

/** Uploading a question's picture: the id to put in the form, or undefined
 * when the file was refused (the reason is shown). */
const useImageUpload = (api: TestBuilderApi = testBuilderApi) => {
    const [uploading, setUploading] = useState(false);
    const upload = async (file: File): Promise<string | undefined> => {
        setUploading(true);
        try {
            return (await api.uploadImage(file)).hash;
        } catch (error) {
            console.error("Ошибка при загрузке картинки:", error);
            toast.error(errorText(error, "Не удалось загрузить картинку"));
            return undefined;
        } finally {
            setUploading(false);
        }
    };
    return { uploading, upload };
};

/** The first thing wrong in the form, in words, and the question it is in.
 * A long test's error may sit far below the button, so it is told up top. */
const firstFormError = (errors: FieldErrors<TestForm>): { message: string; question?: number } => {
    const field = (["department", "discipline", "topic", "description"] as const).find((name) => errors[name]);
    if (field) return { message: errors[field]?.message ?? "Проверьте поля теста" };

    const questions = errors.questions;
    const listMessage = questions?.root?.message ?? questions?.message;
    if (listMessage) return { message: listMessage };
    if (!Array.isArray(questions)) return { message: "Проверьте поля теста" };

    const index = questions.findIndex(Boolean);
    const question = questions[index];
    const answers = question?.answers;
    const answerIndex = Array.isArray(answers) ? answers.findIndex(Boolean) : -1;
    const message =
        question?.text?.message ??
        answers?.root?.message ??
        answers?.message ??
        (answerIndex >= 0 ? `вариант ${answerIndex + 1}: ${answers?.[answerIndex]?.text?.message ?? "проверьте"}` : undefined) ??
        "проверьте вопрос";
    return { message: `Вопрос ${index + 1}: ${message}`, question: index };
};

/** The create/edit form of one test. */
const useTestForm = (onSaved: () => Promise<void>, api: TestBuilderApi, exam = false) => {
    const [editing, setEditing] = useState<Test>();
    // What the import asks to check before saving; empty for a hand-made test.
    const [warnings, setWarnings] = useState<string[]>([]);
    const form = useForm<TestForm>({
        resolver: zodResolver(exam ? examTestSchema : testSchema),
        defaultValues: emptyTestForm(),
    });

    const handleSubmit = form.handleSubmit(async (values) => {
        try {
            if (editing) await api.update(editing.id, values);
            else await api.create(values);
            toast.success(editing ? "Тест обновлён" : "Тест создан");
            await onSaved();
        } catch (error) {
            console.error("Ошибка при сохранении теста:", error);
            toast.error(errorText(error, "Не удалось сохранить тест"));
        }
    }, (errors) => {
        const { message, question } = firstFormError(errors);
        toast.error(`Тест не сохранён. ${message}`);
        if (question !== undefined) {
            document.querySelector(`[data-question-index="${question}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    });

    return { form, handleSubmit, editing, setEditing, warnings, setWarnings };
};

/** State of the test builder: the tests, a search by topic and
 * creating/editing/deleting tests. */
const useTestBuilder = (version: TestForm["version"] = TestVersion.V1, api: TestBuilderApi = testBuilderApi, exam = false) => {
    const [tests, setTests] = useState<Test[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [search, setSearch] = useState("");
    // The department section's key (see departmentKey); undefined = all.
    const [department, setDepartment] = useState<string>();

    const fetch = async () => {
        setLoading(true);
        setError(false);
        try {
            setTests(await api.fetch());
        } catch (err) {
            console.error("Ошибка при получении тестов:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const modal = useCommonModal();
    const formState = useTestForm(async () => {
        modal.closeModal();
        await fetch();
    }, api, exam);

    const openCreate = () => {
        formState.setEditing(undefined);
        formState.setWarnings([]);
        formState.form.reset(emptyTestForm(version));
        modal.openModal("create");
    };

    const openEdit = (test: Test) => {
        formState.setEditing(test);
        formState.setWarnings([]);
        formState.form.reset(toForm(test));
        modal.openModal("update");
    };

    const remove = async (test: Test) => {
        if (!confirm(`Удалить тест «${test.topic}» со всеми вопросами?`)) return;
        try {
            await api.remove(test.id);
            toast.success("Тест удалён");
            await fetch();
        } catch (err) {
            console.error("Ошибка при удалении теста:", err);
            toast.error(errorText(err, "Не удалось удалить тест"));
        }
    };

    const [importing, setImporting] = useState(false);

    const bulk = useBulkImport(tests, fetch, version, api, exam);

    /** One file opens the create form filled from it; several — the bulk import. */
    const importFiles = (files: File[]) => {
        if (files.length === 1) importFile(files[0]);
        else if (files.length > 1) bulk.open(files);
    };

    /** Opens the create form filled from a supplied .docx or .txt, to check and save. */
    const importFile = async (file: File) => {
        setImporting(true);
        try {
            const draft = await api.importParse(file);
            formState.setEditing(undefined);
            formState.setWarnings(draft.warnings);
            formState.form.reset({ ...draft.form, version });
            modal.openModal("create");
            toast.success(`Прочитано вопросов: ${draft.form.questions.length}. Проверьте и сохраните тест.`);
        } catch (err) {
            console.error("Ошибка при импорте теста:", err);
            toast.error(errorText(err, "Не удалось импортировать файл"));
        } finally {
            setImporting(false);
        }
    };

    const exportFile = async (test: Test) => {
        try {
            const { fileName, content } = await api.export(test.id);
            downloadFile(fileName || "test.rtf", content);
        } catch (err) {
            console.error("Ошибка при выгрузке теста:", err);
            toast.error(errorText(err, "Не удалось выгрузить тест"));
        }
    };

    const visible = useMemo(() => {
        const query = search.trim().toLocaleLowerCase("ru");
        return tests
            .filter((test) => test.version === version)
            .filter((test) => department === undefined || departmentKey(test.department) === department)
            .filter(
                (test) =>
                    !query ||
                    test.topic.toLocaleLowerCase("ru").includes(query) ||
                    test.discipline.toLocaleLowerCase("ru").includes(query),
            );
    }, [tests, search, department, version]);
    const grouping = exam ? groupExamByDepartment : groupByDepartment;
    const departments = useMemo(() => grouping(visible), [visible, exam]);
    const allDepartments = useMemo(() => grouping(tests.filter((test) => test.version === version)), [tests, version, exam]);
    // Radix Select can't take an empty value, so "Без кафедры" (key "") gets a sentinel.
    const departmentOptions = allDepartments.map((section) => ({ value: section.key || NO_DEPARTMENT_VALUE, label: section.title }));
    // Offered while typing the department, so one department isn't spelled ten ways.
    const departmentSuggestions = allDepartments.filter((section) => section.key).map((section) => section.title);
    const disciplineSuggestions = useMemo(() => suggestionsOf(tests, (test) => test.discipline, disciplineKey), [tests]);

    // Departments and disciplines fold away. Without filters everything is
    // folded until opened by hand; with a search or a filter everything found
    // is open, except what was folded by hand since the filters last changed.
    const filtering = Boolean(search.trim()) || department !== undefined;
    const departmentKeys = departments.map((section) => section.key);
    const disciplineKeys = departments.flatMap((section) => section.disciplines.map((discipline) => discipline.key));
    const [opened, setOpened] = useState<string[]>([]);
    const [foldedWhileFiltering, setFoldedWhileFiltering] = useState<string[]>([]);
    const isOpen = (key: string) => (filtering ? !foldedWhileFiltering.includes(key) : opened.includes(key));
    const setOpenAmong = (keys: string[]) => (value: string[]) => {
        if (filtering) setFoldedWhileFiltering((current) => [...current.filter((key) => !keys.includes(key)), ...keys.filter((key) => !value.includes(key))]);
        else setOpened((current) => [...current.filter((key) => !keys.includes(key)), ...value]);
    };
    const expandAll = () => (filtering ? setFoldedWhileFiltering([]) : setOpened([...departmentKeys, ...disciplineKeys]));
    const collapseAll = () => (filtering ? setFoldedWhileFiltering([...departmentKeys, ...disciplineKeys]) : setOpened([]));
    /** A filter change opens everything it finds again. */
    const refilter = <T,>(set: (value: T) => void) => (value: T) => {
        setFoldedWhileFiltering([]);
        set(value);
    };

    return {
        fetch,
        api,
        exam,
        loading,
        error,
        empty: !tests.some((test) => test.version === version),
        search,
        setSearch: refilter(setSearch),
        department: department === "" ? NO_DEPARTMENT_VALUE : department,
        setDepartment: refilter((value: string | undefined) => setDepartment(value === NO_DEPARTMENT_VALUE ? "" : value)),
        departmentOptions,
        departmentSuggestions,
        disciplineSuggestions,
        openDepartments: departmentKeys.filter(isOpen),
        setOpenDepartments: setOpenAmong(departmentKeys),
        openDisciplines: disciplineKeys.filter(isOpen),
        setOpenDisciplines: setOpenAmong(disciplineKeys),
        expandAll,
        collapseAll,
        visible,
        departments,
        modal,
        formState,
        openCreate,
        openEdit,
        remove,
        exportFile,
        importing,
        importFiles,
        bulk,
    };
};

export { useImageUpload, useTestBuilder };
