import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { examTestTakeApi, TestTakePanel, testTakeApi, useTestTake } from "@/widgets/test-take";

/** Standalone page where a student takes a test by its session link — no
 * login, no sidebar: name and group, then the timed questions. */
export default function TestTakePage({ exam = false }: { exam?: boolean }) {
    const { token = "" } = useParams<{ token: string }>();
    const take = useTestTake(token, exam ? examTestTakeApi : testTakeApi, exam);

    useEffect(() => {
        take.load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    return (
        <section className="w-full min-w-0 px-4 py-6 sm:px-6">
            <TestTakePanel take={take} />
        </section>
    );
}
