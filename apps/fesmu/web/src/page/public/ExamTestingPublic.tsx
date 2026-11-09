import { useEffect, useRef, useState } from "react";
import { createClient, ConnectError } from "@connectrpc/connect";
import { ExamTestSessionService } from "@fesmu/contract/fesmu/exam/service/v1/exam_test_session.service_pb";
import type { ExamPublicTest, ExamPublicStudent } from "@fesmu/contract/fesmu/exam/service/v1/exam_test_session.service_pb";
import { connectTransport } from "@/shared/config/api";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { examTestTakeApi, TestTakePanel, useTestTake } from "@/widgets/test-take";

const client = createClient(ExamTestSessionService, connectTransport);
const sorted = (items: string[]) => [...new Set(items)].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));

function ExamAttempt({ token, recordBook, onBack }: { token: string; recordBook:string; onBack: () => void }) {
    const take = useTestTake(token, examTestTakeApi, true, true, recordBook);
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
    const [student,setStudent]=useState<ExamPublicStudent>();
    const autoOpen=useRef(false);
    const [loading, setLoading] = useState(true);
    const [recordBook,setRecordBook]=useState("");
    const [input,setInput]=useState("");
    const [error,setError]=useState("");
    const [failed, setFailed] = useState(false);
    const [faculty, setFaculty] = useState("");
    const [semester, setSemester] = useState("");
    const [subject, setSubject] = useState("");
    const [selected, setSelected] = useState<string>();
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        if (selected || !recordBook) return;
        let active = true;
        const load = async () => {
            try {
                const response = await client.examPublicFetch({recordBook});
                if (active) {
                    setExams(response.list);setStudent(response.student);setFailed(false);setError("");
                    if(autoOpen.current){autoOpen.current=false;if(response.list.length===1)setSelected(response.list[0].token);}
                }
            } catch(err) {
                if (active){setFailed(true);setExams([]);setStudent(undefined);setError(err instanceof ConnectError?err.rawMessage:"Не удалось проверить назначенные экзамены");}
            } finally {
                if (active) setLoading(false);
            }
        };
        void load();
        const timer = setInterval(() => void load(), 30000);
        return () => { active = false; clearInterval(timer); };
    }, [selected, refresh,recordBook]);

    const byFaculty = exams.filter((exam) => !faculty || exam.faculty === faculty);
    const bySemester = byFaculty.filter((exam) => !semester || exam.semester === Number(semester));
    const visible = bySemester.filter((exam) => !subject || exam.subject === subject)
        .sort((a, b) => a.faculty.localeCompare(b.faculty, "ru") || a.semester - b.semester || a.subject.localeCompare(b.subject, "ru") || a.title.localeCompare(b.title, "ru", { numeric: true }));

    return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <header>
            <h1 className="text-3xl font-bold">Экзаменационное тестирование</h1>
            {!selected && <p className="mt-2 text-muted-foreground">Введите номер зачётной книжки. Вы увидите только экзамены, назначенные вам. Вход в личный кабинет не требуется.</p>}
        </header>
        {student && <Card className="gap-1 p-4" aria-label="Данные студента">
            <p className="text-lg font-semibold">{student.fullName}</p>
            <p className="text-sm text-muted-foreground">Группа {student.studentGroup || "не указана"}{student.course>0 && ` · ${student.course} курс`}{student.faculty && ` · ${student.faculty}`}</p>
        </Card>}
        {!recordBook ? <Card className="mx-auto w-full max-w-md p-6">
            <form className="flex flex-col gap-4" onSubmit={e=>{e.preventDefault();if(!/^[0-9]{7}$/.test(input.trim())){setError("Введите 7 цифр номера зачётной книжки");return;}setExams([]);setStudent(undefined);autoOpen.current=true;setError("");setFailed(false);setLoading(true);setRecordBook(input.trim());}}>
                <label className="flex flex-col gap-2 font-medium">Номер зачётной книжки<input className="rounded-md border bg-background p-3" value={input} onChange={e=>setInput(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={7} placeholder="7 цифр" required /></label>
                {error&&<p className="text-sm text-destructive" role="alert">{error}</p>}
                <Button type="submit">Показать мои экзамены</Button>
            </form>
        </Card> : selected ? <ExamAttempt key={`${selected}:${recordBook}`} token={selected} recordBook={recordBook} onBack={() => setSelected(undefined)} /> : <>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Номер зачётки: {recordBook}</p><Button variant="outline" onClick={()=>{setRecordBook("");setInput("");setStudent(undefined);autoOpen.current=false;setExams([]);setError("");setFaculty("");setSemester("");setSubject("");}}>Другой студент</Button></div>
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
                <p role="alert">{error||"Не удалось проверить назначенные экзамены"}</p>
                <Button variant="outline" className="self-start" onClick={() => setRefresh((value) => value + 1)}>Повторить</Button>
            </Card> : visible.length === 0 ? <Card className="p-6"><p>Вам пока не назначены открытые экзамены по выбранным условиям. Обратитесь к преподавателю.</p></Card> : <div className="grid gap-4 sm:grid-cols-2">
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
