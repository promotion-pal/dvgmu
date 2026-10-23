import { useEffect } from "react";
import { PlusIcon } from "lucide-react";
import { Can } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { TestBuilderBulkImportModal, TestBuilderFilters, TestBuilderFormModal, TestBuilderImport, TestBuilderList, askableQuestionCount, useTestBuilder } from "@/widgets/test-builder";
import { TestSessionCreateModal, useTestSessionCreate } from "@/widgets/test-session";
import { TestVersion } from "@dvgmu/contract/fesmu/enum/v1/test.enum_pb";

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
export default function TestBuilderPage({ version }: { version: TestVersion.V1 | TestVersion.V2 }) {
    const state = useTestBuilder(version);
    const sessionCreate = useTestSessionCreate();

    useEffect(() => {
        state.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version]);

    return (
        <CommonWrapper
            title={PAGE[version].title}
            description={PAGE[version].description}
            action={
                <Can section={PermissionSection.TESTS}>
                    <div className="flex items-center gap-4">
                        <TestBuilderImport state={state} />
                        <PlusIcon className="size-4 cursor-pointer" onClick={state.openCreate} aria-label="Создать тест" />
                    </div>
                </Can>
            }
            filter={{ render: { count: state.visible.length, children: <TestBuilderFilters state={state} /> } }}
        >
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
            />
            <TestSessionCreateModal state={sessionCreate} />
        </CommonWrapper>
    );
}
