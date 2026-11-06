import { useRef } from "react";
import type { FC } from "react";
import { ImageIcon, XIcon, ArrowLeftRightIcon, BookOpenIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, CheckCircle2Icon, CircleIcon, FileDownIcon, SendIcon, FileUpIcon, FolderIcon, LandmarkIcon, TriangleAlertIcon, ListChecksIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { FormProvider, get, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import type { FieldErrors } from "react-hook-form";
import { PromFieldCheckbox, PromFieldInput, PromFieldTextArea } from "@/features/lib/form";
import { cn } from "@/shared/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/accordion";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { CommonFilterSelect, CommonSearchInput } from "@/shared/components/filter";
import { CommonPopover } from "@/shared/components/menu";
import { useCan } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
import { CommonModal } from "@/shared/components/modal";
import { useImageUpload } from "./test-builder.fn";
import type { useTestBuilder } from "./test-builder.fn";
import { CommonImage } from "@/shared/components/image";
import { testImageUrl } from "@/shared/lib/test-image";
import { IMPORT_ACCEPT } from "./test-builder.bulk.ui";
import { emptyAnswer, emptyQuestion, TestVersion } from "./test-builder.schema";
import { askableQuestionCount, distinctQuestionCount } from "./test-builder.utils";
import type { Test, TestForm } from "./test-builder.schema";

type TestBuilder = ReturnType<typeof useTestBuilder>;

const plural = (count: number, one: string, few: string, many: string) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
    return `${count} ${many}`;
};

const questionsLabel = (count: number) => plural(count, "вопрос", "вопроса", "вопросов");
const testsLabel = (count: number) => plural(count, "тест", "теста", "тестов");
const variantsLabel = (count: number) => plural(count, "вариант", "варианта", "вариантов");

/** An array-level message (min/refine on a list); zod puts it either on the
 * array itself or, for a field array, under `root`. */
const listError = (errors: FieldErrors<TestForm>, name: string): string | undefined => {
    const error = get(errors, name);
    return error?.root?.message ?? error?.message;
};

/* ───────────── filters ───────────── */

const TestBuilderFilters: FC<{ state: TestBuilder }> = ({ state }) => (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <CommonFilterSelect
            label="Кафедра"
            value={state.department}
            onChange={state.setDepartment}
            options={state.departmentOptions}
            allLabel="Все кафедры"
            className="[&_button]:min-w-64"
        />
        <CommonSearchInput value={state.search} onChange={state.setSearch} placeholder="Поиск по теме" />
    </div>
);

/* ───────────── import ───────────── */

/** Picks supplied .docx/.txt files: one opens the create form filled from it,
 * several — the bulk import. */
const TestBuilderImport: FC<{ state: TestBuilder }> = ({ state }) => {
    const input = useRef<HTMLInputElement>(null);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={state.importing}
                onClick={() => input.current?.click()}
                title="Можно выбрать сразу несколько файлов"
            >
                <FileUpIcon className="size-4" />
                {state.importing ? "Чтение файла…" : "Импорт из .docx / .txt"}
            </Button>
            <input
                ref={input}
                type="file"
                multiple
                accept={IMPORT_ACCEPT}
                className="hidden"
                onChange={(event) => {
                    const files = [...(event.target.files ?? [])];
                    // Reset so picking the same file again still fires onChange.
                    event.target.value = "";
                    state.importFiles(files);
                }}
            />
        </>
    );
};

/* ───────────── list ───────────── */

const TestQuestions: FC<{ test: Test; exam?: boolean }> = ({ test, exam = false }) => (
    <ol className="flex flex-col gap-4">
        {test.questions.map((question, index) => (
            <li key={question.id} className="flex flex-col gap-2">
                <p className="font-medium whitespace-pre-line">
                    {index + 1}. {question.text}
                </p>
                {question.image && (
                    <CommonImage
                        src={testImageUrl(question.image.hash, exam)}
                        alt={`Картинка к вопросу ${index + 1}`}
                        width={question.image.width}
                        height={question.image.height}
                        className="max-h-80 w-fit"
                    />
                )}
                <ul className="flex flex-col gap-1 pl-4">
                    {question.answers.map((answer) => (
                        <li
                            key={answer.id}
                            className={cn("flex items-start gap-2", answer.isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}
                        >
                            {answer.isCorrect ? (
                                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-label="Верный ответ" />
                            ) : (
                                <CircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                            )}
                            <span className="whitespace-pre-line">{answer.text}</span>
                        </li>
                    ))}
                </ul>
            </li>
        ))}
    </ol>
);

/** Hands a test out to students as a timed session (see widgets/test-session). */
type HandOut = (test: Test) => void;

const TestRow: FC<{ test: Test; state: TestBuilder; onHandOut?: HandOut }> = ({ test, state, onHandOut }) => {
    // Without the right to change tests the row only shows and exports.
    const canEdit = useCan(PermissionSection.TESTS);

    return (
    <AccordionItem value={test.id}>
        <div className="flex items-center gap-2 [&>h3]:min-w-0 [&>h3]:flex-1">
            <AccordionTrigger className="items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-base">{test.topic}</span>
                    {test.description && <span className="text-xs font-normal text-muted-foreground">{test.description}</span>}
                </span>
                <Badge variant="secondary" className="ml-auto shrink-0">
                    {questionsLabel(askableQuestionCount(test))}
                    {test.version === TestVersion.V2 &&
                        distinctQuestionCount(test.questions) < test.questions.length &&
                        ` · ${variantsLabel(test.questions.length)}`}
                </Badge>
            </AccordionTrigger>
            <CommonPopover
                items={[
                    ...(onHandOut && canEdit
                        ? [{ label: "Выдать студентам", icon: <SendIcon className="h-3.5 w-3.5" />, onClick: () => onHandOut(test) }]
                        : []),
                    {
                        label: "Выгрузить в RTF",
                        icon: <FileDownIcon className="h-3.5 w-3.5" />,
                        onClick: () => state.exportFile(test),
                    },
                    ...(canEdit
                        ? [
                              {
                                  label: "Редактировать",
                                  icon: <PencilIcon className="h-3.5 w-3.5" />,
                                  onClick: () => state.openEdit(test),
                              },
                              {
                                  label: "Удалить",
                                  icon: <TrashIcon className="h-3.5 w-3.5" />,
                                  style: "text-destructive hover:text-destructive",
                                  onClick: () => state.remove(test),
                              },
                          ]
                        : []),
                ]}
            />
        </div>
        <AccordionContent>
            <TestQuestions test={test} exam={state.exam} />
        </AccordionContent>
    </AccordionItem>
    );
};

/** Every test as an accordion row: the topic up top, its questions with the
 * correct answers marked inside. Folded by department, then by discipline;
 * inside, tests with similar topics are grouped. */
const TestBuilderList: FC<{ state: TestBuilder; onHandOut?: HandOut }> = ({ state, onHandOut }) => {
    if (state.visible.length === 0) {
        return (
            <Empty className="rounded-xl border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <ListChecksIcon />
                    </EmptyMedia>
                    <EmptyTitle>Тестов нет</EmptyTitle>
                    <EmptyDescription>
                        {state.empty ? "Создайте первый тест кнопкой «+» вверху." : "По выбранным фильтрам ничего не найдено."}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={state.expandAll}>
                    <ChevronsUpDownIcon className="size-4" />
                    Развернуть все
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={state.collapseAll}>
                    <ChevronsDownUpIcon className="size-4" />
                    Свернуть все
                </Button>
            </div>
            <Accordion type="multiple" value={state.openDepartments} onValueChange={state.setOpenDepartments} className="flex flex-col gap-3">
                {state.departments.map((section) => (
                    <AccordionItem key={section.key} value={section.key} className="rounded-xl border px-4 not-last:border-b">
                        <AccordionTrigger className="items-center gap-2 hover:no-underline">
                            <span className="flex flex-1 items-center gap-2">
                                <LandmarkIcon className="size-5 shrink-0 text-primary" />
                                <span className="text-lg font-semibold">{section.title}</span>
                                <Badge variant="secondary">{testsLabel(section.count)}</Badge>
                            </span>
                        </AccordionTrigger>
                        <AccordionContent>
                            <Accordion
                                type="multiple"
                                value={state.openDisciplines}
                                onValueChange={state.setOpenDisciplines}
                                className="flex flex-col gap-2"
                            >
                                {section.disciplines.map((discipline) => (
                                    <AccordionItem key={discipline.key} value={discipline.key} className="rounded-lg border bg-muted/20 px-3 not-last:border-b">
                                        <AccordionTrigger className="items-center gap-2 py-3 hover:no-underline">
                                            <span className="flex flex-1 items-center gap-2">
                                                <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" />
                                                <span className="font-semibold">{discipline.title}</span>
                                                <Badge variant="outline">{testsLabel(discipline.count)}</Badge>
                                            </span>
                                        </AccordionTrigger>
                                        <AccordionContent className="flex flex-col gap-4">
                                            {discipline.groups.map((group) => (
                                                <div key={group.key} className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <FolderIcon className="size-4 text-muted-foreground" />
                                                        <h3 className="font-semibold">{group.title}</h3>
                                                        <Badge variant="outline">{testsLabel(group.tests.length)}</Badge>
                                                    </div>
                                                    <Card className="gap-0 px-4 py-0">
                                                        <Accordion type="multiple">
                                                            {group.tests.map((test) => (
                                                                <TestRow key={test.id} test={test} state={state} onHandOut={onHandOut} />
                                                            ))}
                                                        </Accordion>
                                                    </Card>
                                                </div>
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
};

/* ───────────── form ───────────── */

const FieldInput = PromFieldInput<TestForm>;

const MAX_ANSWERS = 30;

/** A question's picture: shown with "Заменить" and "Убрать", or a button to add one. */
const QuestionImageField: FC<{ index: number; api: TestBuilder["api"]; exam: boolean }> = ({ index, api, exam }) => {
    const { control, setValue } = useFormContext<TestForm>();
    const image = useWatch({ control, name: `questions.${index}.image` });
    const input = useRef<HTMLInputElement>(null);
    const { uploading, upload } = useImageUpload(api);

    const pick = async (file: File | undefined) => {
        if (!file) return;
        const hash = await upload(file);
        if (hash) setValue(`questions.${index}.image`, hash, { shouldDirty: true });
    };

    return (
        <div className="flex flex-col gap-2">
            {image && <CommonImage src={testImageUrl(image, exam)} alt={`Картинка к вопросу ${index + 1}`} className="max-h-72 w-fit" />}
            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
                    <ImageIcon className="size-4" />
                    {uploading ? "Загрузка…" : image ? "Заменить картинку" : "Добавить картинку"}
                </Button>
                {image && (
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setValue(`questions.${index}.image`, "", { shouldDirty: true })}>
                        <XIcon className="size-4" />
                        Убрать картинку
                    </Button>
                )}
            </div>
            <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void pick(file);
                }}
            />
        </div>
    );
};

/** V1: the options as one list, each with a "Верный" mark — shown to the
 * student all of them, as written. */
const ClassicAnswers: FC<{ index: number }> = ({ index }) => {
    const { control } = useFormContext<TestForm>();
    const answers = useFieldArray({ control, name: `questions.${index}.answers` });

    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Варианты ответа — отметьте верные (можно несколько)</p>
            {answers.fields.map((field, answerIndex) => (
                <div key={field.id} className="flex items-start gap-3">
                    <PromFieldCheckbox<TestForm> name={`questions.${index}.answers.${answerIndex}.isCorrect`} label="Верный" className="mt-2.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <FieldInput name={`questions.${index}.answers.${answerIndex}.text`} placeholder={`Вариант ${answerIndex + 1}`} />
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-1 shrink-0"
                        onClick={() => answers.remove(answerIndex)}
                        disabled={answers.fields.length <= 2}
                        aria-label="Удалить вариант"
                    >
                        <TrashIcon className="size-4" />
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() => answers.append(emptyAnswer())}
                disabled={answers.fields.length >= MAX_ANSWERS}
            >
                <PlusIcon className="size-4" />
                Добавить вариант
            </Button>
        </div>
    );
};

/** V2: the right and wrong answers as two lists. A session shows each
 * student a random mix of them, so a question may have more answers than are
 * shown at once. */
const PoolAnswers: FC<{ index: number }> = ({ index }) => {
    const { control, formState, setValue } = useFormContext<TestForm>();
    const answers = useFieldArray({ control, name: `questions.${index}.answers` });
    const values = useWatch({ control, name: `questions.${index}.answers` }) ?? [];

    const rows = answers.fields.map((field, answerIndex) => ({ field, answerIndex, correct: Boolean(values[answerIndex]?.isCorrect) }));
    const full = answers.fields.length >= MAX_ANSWERS;

    const group = (correct: boolean) => {
        const items = rows.filter((row) => row.correct === correct);
        return (
            <div
                className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3",
                    correct ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20" : "bg-muted/20",
                )}
            >
                <p className={cn("flex items-center gap-2 text-sm font-medium", correct ? "text-emerald-800 dark:text-emerald-300" : "text-muted-foreground")}>
                    {correct ? <CheckCircle2Icon className="size-4" /> : <CircleIcon className="size-4" />}
                    {correct ? "Верные ответы" : "Неверные ответы"}
                    <span className="font-normal">· {items.length}</span>
                </p>
                {items.map(({ field, answerIndex }) => (
                    <div key={field.id} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <FieldInput
                                name={`questions.${index}.answers.${answerIndex}.text`}
                                placeholder={correct ? "Верный ответ" : "Неверный ответ"}
                            />
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-1 shrink-0 text-muted-foreground"
                            onClick={() => setValue(`questions.${index}.answers.${answerIndex}.isCorrect`, !correct, { shouldValidate: formState.isSubmitted })}
                            title={correct ? "Перенести в неверные" : "Перенести в верные"}
                            aria-label={correct ? "Перенести в неверные" : "Перенести в верные"}
                        >
                            <ArrowLeftRightIcon className="size-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-1 shrink-0"
                            onClick={() => answers.remove(answerIndex)}
                            disabled={answers.fields.length <= 2}
                            aria-label="Удалить вариант"
                        >
                            <TrashIcon className="size-4" />
                        </Button>
                    </div>
                ))}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit"
                    onClick={() => answers.append({ text: "", isCorrect: correct })}
                    disabled={full}
                >
                    <PlusIcon className="size-4" />
                    {correct ? "Добавить верный" : "Добавить неверный"}
                </Button>
            </div>
        );
    };

    return (
        <>
            <div className="grid gap-3 md:grid-cols-2">
                {group(true)}
                {group(false)}
            </div>
            <p className="text-xs text-muted-foreground">
                Верных может быть несколько. Если ответов больше, чем показывается в сессии, каждый студент получит свою случайную смесь
                верных и неверных — не больше {MAX_ANSWERS} ответов в вопросе.
            </p>
        </>
    );
};

/** One question of the form: its text, picture and answers — by the test's
 * version as one list of options (V1) or right and wrong lists (V2). */
const QuestionEditor: FC<{ index: number; canRemove: boolean; onRemove: () => void; api: TestBuilder["api"]; exam: boolean }> = ({ index, canRemove, onRemove, api, exam }) => {
    const { control, formState } = useFormContext<TestForm>();
    const version = useWatch({ control, name: "version" });
    const answersError = listError(formState.errors, `questions.${index}.answers`);

    return (
        <div data-question-index={index} className={cn("flex flex-col gap-3 rounded-xl border p-4", answersError && "border-red-400")}>
            <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Вопрос {index + 1}</p>
                <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove} className="text-muted-foreground">
                    <TrashIcon className="size-4" />
                    Удалить вопрос
                </Button>
            </div>

            <PromFieldTextArea<TestForm> name={`questions.${index}.text`} placeholder="Текст вопроса" rows={2} />
            <QuestionImageField index={index} api={api} exam={exam} />

            {version === TestVersion.V2 ? <PoolAnswers index={index} /> : <ClassicAnswers index={index} />}
            {answersError && <span className="text-sm text-red-500">{answersError}</span>}
        </div>
    );
};

/** Staff: build a new test or edit one — topic, description, questions and answers. */
const TestBuilderFormModal: FC<{ state: TestBuilder }> = ({ state }) => {
    const { form, handleSubmit, editing, warnings } = state.formState;
    const questions = useFieldArray({ control: form.control, name: "questions" });
    const questionsError = listError(form.formState.errors, "questions");

    return (
        <CommonModal
            open={state.modal.open}
            onOpenChange={state.modal.onOpenChange}
            title={`${editing ? "Редактирование теста" : "Новый тест"} ${form.getValues("version") === TestVersion.V2 ? "V2" : "V1"}`}
            description={
                form.getValues("version") === TestVersion.V2
                    ? "Тема, вопросы и списки верных и неверных ответов. Каждый студент увидит свою смесь из них."
                    : "Тема, вопросы и варианты ответа — отметьте верные (один или несколько). Студенты получат добавленные вопросы как записаны."
            }
            className="sm:max-w-3xl"
        >
            <FormProvider {...form}>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {warnings.length > 0 && (
                        <div className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                            <p className="flex items-center gap-2 font-medium">
                                <TriangleAlertIcon className="size-4 shrink-0" />
                                Проверьте перед сохранением
                            </p>
                            <ul className="ml-6 list-disc">
                                {warnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <FieldInput
                        name="department"
                        label="Кафедра"
                        placeholder="Например: Кафедра анатомии"
                        maxLength={255}
                        suggestions={state.departmentSuggestions}
                    />
                    <FieldInput
                        name="discipline"
                        label="Дисциплина"
                        placeholder="Например: Анатомия человека"
                        maxLength={255}
                        suggestions={state.disciplineSuggestions}
                    />
                    <FieldInput name="topic" label="Тема теста" placeholder="Например: Анатомия — кости черепа" maxLength={255} />
                    <PromFieldTextArea<TestForm> name="description" label="Описание" placeholder="Необязательно" rows={2} />

                    {questions.fields.map((field, index) => (
                        <QuestionEditor
                            key={field.id}
                            index={index}
                            canRemove={questions.fields.length > 1}
                            onRemove={() => questions.remove(index)}
                            api={state.api}
                            exam={state.exam}
                        />
                    ))}
                    {questionsError && <span className="text-sm text-red-500">{questionsError}</span>}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button type="button" variant="outline" onClick={() => questions.append(emptyQuestion())}>
                            <PlusIcon className="size-4" />
                            Добавить вопрос
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {editing ? "Сохранить" : "Создать тест"}
                        </Button>
                    </div>
                </form>
            </FormProvider>
        </CommonModal>
    );
};

export { TestBuilderFilters, TestBuilderFormModal, TestBuilderImport, TestBuilderList };
