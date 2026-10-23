import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, FileDownIcon } from "lucide-react";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { TestSessionResultsHeader, TestSessionResultsTable, TestSessionSheetModal, useTestSessionResults, useTestSessionSheet } from "@/widgets/test-session";

/** Staff: one session's results — every student's score and, unfolded, their answers. */
export default function TestSessionResultsPage() {
    const { id } = useParams<{ id: string }>();
    const state = useTestSessionResults(id);
    const session = state.results?.session;
    const sheet = useTestSessionSheet(state.results);

    useEffect(() => {
        state.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    return (
        <CommonWrapper
            title={session ? `Результаты: ${session.topic}` : "Результаты тестирования"}
            description={session?.note}
            action={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={sheet.open} disabled={!sheet.hasFinished} title={sheet.hasFinished ? undefined : "Пока нет завершённых попыток"}>
                        <FileDownIcon className="size-4" />
                        Ведомость (Word)
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                        <Link to={ROUTE.TESTS.SESSIONS}>
                            <ArrowLeftIcon className="size-4" />
                            Все сессии
                        </Link>
                    </Button>
                </div>
            }
        >
            <CommonControlState isLoading={state.loading} isError={state.error} isEmpty={false}>
                <div className="flex flex-col gap-6">
                    <TestSessionResultsHeader state={state} />
                    <TestSessionResultsTable state={state} />
                </div>
            </CommonControlState>
            <TestSessionSheetModal sheet={sheet} />
        </CommonWrapper>
    );
}
