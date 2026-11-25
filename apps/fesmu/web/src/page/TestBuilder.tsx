import { useEffect } from "react";
import { PlusIcon } from "lucide-react";
import { Can } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { TestBuilderBulkImportModal, TestBuilderFilters, TestBuilderFormModal, TestBuilderImport, TestBuilderList, askableQuestionCount, examTestBuilderApi, testBuilderApi, useTestBuilder } from "@/widgets/test-builder";
import { TestSessionCreateModal, examTestSessionApi, testSessionApi, useTestSessionCreate } from "@/widgets/test-session";
import { TestVersion } from "@fesmu/contract/fesmu/enum/v1/test.enum_pb";
import { CommonShareLink } from "@/shared/components/share";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";

const PAGE = {
    [TestVersion.V1]: {
        title: "Тесты V1 · Банк вопросов",
        description: "Вопросы по теме с вариантами ответа — каждый студент получает свой набор без повторов",
    },
    [TestVersion.V2]: {
        title: "Тесты V2 · Верные и неверные ответы",
        description: "Списки верных и неверных ответов — каждый студент видит свою случайную смесь",
    },
} as const;

/** Staff page of the test builder for one version: tests by topic, their
 * questions and answers with the correct ones marked; creating, editing and
 * deleting; handing a test out to students as a timed session. */
export default function TestBuilderPage({ version, exam = false }: { version: TestVersion.V1 | TestVersion.V2; exam?: boolean }) {
    const api = exam ? examTestBuilderApi : testBuilderApi;
    const state = useTestBuilder(version, api, exam);
    const sessionCreate = useTestSessionCreate(exam ? examTestSessionApi : testSessionApi, exam);

    useEffect(() => {
        state.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version,exam]);

    return (
        <CommonWrapper
            title={exam ? "Экзаменационное тестирование" : PAGE[version].title}
            description={exam ? "Одна открытая страница для компьютерного класса. В меню теста выберите «Открыть доступ» и назначьте экзамен курсу, группе или студентам из MDM." : PAGE[version].description}
            action={
                <Can section={exam ? PermissionSection.EXAM_TESTS : PermissionSection.TESTS}>
                    <div className="flex items-center gap-4">
                        <TestBuilderImport state={state} />
                        <PlusIcon className="size-4 cursor-pointer" onClick={state.openCreate} aria-label="Создать тест" />
                    </div>
                </Can>
            }
            filter={{ render: { count: state.visible.length, children: <TestBuilderFilters state={state} /> } }}
        >
            {exam && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4">
                <div className="min-w-0 flex-1">
                    <p className="font-semibold">Общая ссылка для компьютерного класса</p>
                    <p className="break-all text-sm text-muted-foreground">{window.location.origin}{ROUTE.PUBLIC.EXAM_TESTING}</p>
                </div>
                <CommonShareLink url={`${window.location.origin}${ROUTE.PUBLIC.EXAM_TESTING}`} label="Скопировать ссылку" />
                <Button asChild variant="outline"><a href={ROUTE.PUBLIC.EXAM_TESTING} target="_blank" rel="noreferrer">Открыть страницу</a></Button>
            </div>}
            <CommonControlState isLoading={state.loading} isError={state.error} isEmpty={false}>
                <TestBuilderList
                    state={state}
                    onHandOut={(test) => sessionCreate.open({ id: test.id, topic: test.topic, questionCount: askableQuestionCount(test), mixed: test.version === TestVersion.V2 })}
                />
            </CommonControlState>
            <TestBuilderFormModal state={state} />
            <TestBuilderBulkImportModal
                state={state.bulk}
                departmentSuggestions={state.departmentSuggestions}
                disciplineSuggestions={state.disciplineSuggestions}
                exam={exam}
            />
        <TestSessionCreateModal state={sessionCreate} exam={exam} />
        </CommonWrapper>
    );
}
