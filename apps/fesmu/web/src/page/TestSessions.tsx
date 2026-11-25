import { useEffect } from "react";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { TestSessionFilters, TestSessionList, useTestSessions } from "@/widgets/test-session";
import { examTestSessionApi, testSessionApi } from "@/widgets/test-session";

/** Staff: every test handed out to students — the link, open/closed, how
 * many have taken it; a row leads to its results. */
export default function TestSessionsPage({ exam = false }: { exam?: boolean }) {
    const state = useTestSessions(exam ? examTestSessionApi : testSessionApi, exam);

    useEffect(() => {
        state.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exam]);

    return (
        <CommonWrapper
            title={exam ? "Сессии экзаменационного тестирования" : "Сессии тестирования"}
            description={exam ? "Доступность экзаменов на общей странице компьютерного класса и результаты студентов" : "Тесты, выданные студентам по ссылке, и их результаты"}
            filter={{ render: { count: state.visible.length, children: <TestSessionFilters state={state} /> } }}
        >
            <CommonControlState isLoading={state.loading} isError={state.error} isEmpty={false}>
                <TestSessionList state={state} />
            </CommonControlState>
        </CommonWrapper>
    );
}
