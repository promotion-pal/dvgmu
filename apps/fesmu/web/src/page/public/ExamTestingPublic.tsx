import { useEffect, useState } from "react";
import { createClient } from "@connectrpc/connect";
import { ExamTestSessionService } from "@fesmu/contract/fesmu/exam/service/v1/exam_test_session.service_pb";
import type { ExamPublicTest } from "@fesmu/contract/fesmu/exam/service/v1/exam_test_session.service_pb";
import { connectTransport } from "@/shared/config/api";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { examTestTakeApi, TestTakePanel, useTestTake } from "@/widgets/test-take";

const client = createClient(ExamTestSessionService, connectTransport);
const sorted = (items: string[]) => [...new Set(items)].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));

function ExamAttempt({ token, onBack }: { token: string; onBack: () => void }) {
    const take = useTestTake(token, examTestTakeApi, true, true);
    useEffect(() => {
        void take.load();
        // A chosen exam has its own registration and attempt; the public URL stays the same.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);
    return <div className="flex flex-col gap-5">
        {take.phase !== "running" && take.phase !== "loading" && (
            <Button variant="outline" className="self-start" onClick={onBack}>Вернуться к выбору экзамена</Button>
        )}
        <TestTakePanel take={take} />
    </div>;
}

/** One permanent URL for every classroom computer. Only exams opened by staff
 * are listed; taking an exam stays on this page and never requires an LK login. */
export default function ExamTestingPublicPage() {
    const [exams, setExams] = useState<ExamPublicTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [faculty, setFaculty] = useState("");
    const [semester, setSemester] = useState("");
    const [subject, setSubject] = useState("");
    const [selected, setSelected] = useState<string>();
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        if (selected) return;
        let active = true;
        const load = async () => {
            try {
                const response = await client.examPublicFetch({});
                if (active) { setExams(response.list); setFailed(false); }
            } catch {
                if (active) setFailed(true);
            } finally {
                if (active) setLoading(false);
            }
        };
        void load();
        const timer = setInterval(() => void load(), 30000);
        return () => { active = false; clearInterval(timer); };
    }, [selected, refresh]);

    const byFaculty = exams.filter((exam) => !faculty || exam.faculty === faculty);
    const bySemester = byFaculty.filter((exam) => !semester || exam.semester === Number(semester));
    const visible = bySemester.filter((exam) => !subject || exam.subject === subject)
        .sort((a, b) => a.faculty.localeCompare(b.faculty, "ru") || a.semester - b.semester || a.subject.localeCompare(b.subject, "ru") || a.title.localeCompare(b.title, "ru", { numeric: true }));

    return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <header>
            <h1 className="text-3xl font-bold">Экзаменационное тестирование</h1>
            {!selected && <p className="mt-2 text-muted-foreground">Выберите факультет, семестр, предмет и экзамен. Для начала укажите ФИО и группу. Вход в личный кабинет не требуется.</p>}
        </header>
        {selected ? <ExamAttempt key={selected} token={selected} onBack={() => setSelected(undefined)} /> : <>
            <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-medium">Направление обучения (факультет)
                    <select className="rounded-md border bg-background p-3" value={faculty} onChange={(e) => { setFaculty(e.target.value); setSemester(""); setSubject(""); }}>
                        <option value="">Все факультеты</option>
                        {sorted(exams.map((exam) => exam.faculty)).map((value) => <option key={value} value={value}>{value || "Без факультета"}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">Семестр
                    <select className="rounded-md border bg-background p-3" value={semester} onChange={(e) => { setSemester(e.target.value); setSubject(""); }}>
                        <option value="">Все семестры</option>
                        {sorted(byFaculty.map((exam) => String(exam.semester))).map((value) => <option key={value} value={value}>Семестр {value}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">Предмет
                    <select className="rounded-md border bg-background p-3" value={subject} onChange={(e) => setSubject(e.target.value)}>
                        <option value="">Все предметы</option>
                        {sorted(bySemester.map((exam) => exam.subject)).map((value) => <option key={value} value={value}>{value || "Без предмета"}</option>)}
                    </select>
                </label>
            </div>
            {loading ? <p role="status">Загружаем экзамены…</p> : failed ? <Card className="p-6">
                <p role="alert">Не удалось загрузить экзамены. Проверьте подключение и повторите попытку.</p>
                <Button variant="outline" className="self-start" onClick={() => setRefresh((value) => value + 1)}>Повторить</Button>
            </Card> : visible.length === 0 ? <Card className="p-6"><p>Сейчас нет доступных экзаменов по выбранным условиям. Дождитесь, пока преподаватель откроет доступ.</p></Card> : <div className="grid gap-4 sm:grid-cols-2">
                {visible.map((exam) => <Card key={exam.testId.toString()} className="flex flex-col p-5">
                    <p className="text-sm text-muted-foreground">{exam.faculty} · семестр {exam.semester}</p>
                    <p className="text-sm font-medium">{exam.subject}</p>
                    <h2 className="text-xl font-semibold">{exam.title}</h2>
                    <p className="text-sm text-muted-foreground">На прохождение: {exam.durationMinutes} мин.</p>
                    <Button className="mt-auto self-start" onClick={() => setSelected(exam.token)}>Начать тест</Button>
                </Card>)}
            </div>}
        </>}
    </main>;
}
