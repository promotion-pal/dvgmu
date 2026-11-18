import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createClient, ConnectError } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { ExamBankService, ExamStudentService, BankSchema, BankSectionSchema } from "@fesmu/contract/fesmu/exam/service/v2/exam_bank.service_pb";
import type { Bank, GeneratedVariant } from "@fesmu/contract/fesmu/exam/service/v2/exam_bank.service_pb";
import { TestQuestionInputSchema, TestAnswerInputSchema } from "@fesmu/contract/fesmu/service/v1/test.service_pb";
import type { TestQuestionInput } from "@fesmu/contract/fesmu/service/v1/test.service_pb";
import { connectTransport } from "@/shared/config/api";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { CommonWrapper } from "@/shared/components/wrapper";
import { examTestBuilderApi } from "@/widgets/test-builder";
import { TestSessionCreateModal, examTestSessionApi, useTestSessionCreate } from "@/widgets/test-session";
import type { TestSession } from "@/widgets/test-session/test-session.schema";
import { Can } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
const client = createClient(ExamBankService, connectTransport);
const ownClient = createClient(ExamStudentService, connectTransport);
const specialties = ["Лечебное дело", "Педиатрия", "Стоматология", "Фармация", "Медицинская биохимия", "Клиническая психология", "Социальная работа", "Сестринское дело", "Фармация медико-фармацевтического колледжа", "Стоматология профилактическая медико-фармацевтического колледжа"];
const field = "w-full rounded-md border bg-background p-2 text-sm";
const errorText = (e: unknown) => e instanceof ConnectError ? e.rawMessage : e instanceof Error ? e.message : "Не удалось выполнить действие";
const fresh = () => create(BankSchema, { specialty: "Педиатрия", faculty: "Педиатрический факультет", semester: 3, academicYear: "2026/2027", season: "winter", variantCount: 1, durationMinutes: 20, excellent: 90, good: 80, satisfactory: 70, sections: [{ name: "Раздел 1", quota: 1, questions: [] }] });
const number = (value: string) => Number(value) || 0;
const newQuestion = () => create(TestQuestionInputSchema, { text: "", answers: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] });
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
function printHtml(title: string, html: string) {
    const w = window.open("", "_blank");
    if (!w) {
        alert("Разрешите открытие окна для печати");
        return;
    }
    w.document.write(`<html lang="ru"><head><title>${esc(title)}</title><style>body{font:12px Arial;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px;text-align:left}h1{font-size:20px}.page{break-after:page}button,input{display:none}@media print{.page:last-child{break-after:auto}}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
}
type StudentRow = {
    asked_question_ids: number[];
    id: number;
    session_id: number;
    name: string;
    group: string;
    score: number;
    total: number;
    percent: number;
    grade: number;
    rank: number;
    finished_at?: string;
    instruction_accepted_at?: string;
    answers: {
        question_id: number;
        answer_ids: number[];
    }[];
    settings: {
        specialty: string;
        discipline: string;
        academic_year: string;
        season: string;
        faculty: string;
    };
    events: {
        at: string;
        kind: string;
        question_id?: number;
        answer_ids?: number[];
    }[];
};
type Summary = {
    key: string;
    count: number;
    average_percent: number;
    average_grade: number;
    grades: Record<string, number>;
};
type Item = {
    id: number;
    text: string;
    asked: number;
    difficulty: number;
    discrimination: number | null;
    correlation: number | null;
    unanswered: number;
    alternatives: {
        text: string;
        correct: boolean;
        count: number;
        percent: number;
        flag: boolean;
    }[];
};
type Report = {
    title: string;
    method: string;
    students: StudentRow[];
    items: Item[];
    summaries: Record<string, Summary[]>;
    questions: {
        id: number;
        text: string;
        answers: {
            id: number;
            text: string;
            is_correct: boolean;
        }[];
    }[];
};
function ReportView({ report }: {
    report: Report;
}) {
    const [selected, setSelected] = useState<number[]>([]);
    const [kind, setKind] = useState("group");
    const summary = report.summaries?.[kind] ?? [];
    const statement = () => `<h1>${esc(report.title)}</h1><table><tr><th>Группа</th><th>ФИО</th><th>Верно</th><th>Оценка</th><th>Рейтинг</th></tr>${report.students.map(s => `<tr><td>${esc(s.group)}</td><td>${esc(s.name)}</td><td>${s.percent.toFixed(2)}%</td><td>${s.grade}</td><td>${s.rank}</td></tr>`).join("")}</table><h2>Сводная ведомость</h2><table><tr><th>Группа</th><th>N</th><th>Верно</th><th>Средний балл</th><th>5 / 4 / 3 / 2</th></tr>${(report.summaries?.group ?? []).map(s => `<tr><td>${esc(s.key)}</td><td>${s.count}</td><td>${s.average_percent.toFixed(2)}%</td><td>${s.average_grade.toFixed(2)}</td><td>${[5, 4, 3, 2].map(g => `${s.grades[g] ?? 0} (${((s.grades[g] ?? 0) / s.count * 100).toFixed(1)}%)`).join(" / ")}</td></tr>`).join("")}</table><p>Начальник сектора цифрового сопровождения учебного процесса УИТиС __________________</p><p>Декан факультета __________________</p>`;
    const protocols = () => report.students.filter(s => selected.includes(s.id)).map(s => `<section class="page"><h1>Протокол тестирования</h1><p>${esc(report.title)} · ${esc(s.name)} · группа ${esc(s.group)}</p><p>${s.score}/${s.total} · ${s.percent.toFixed(2)}% · оценка ${s.grade}</p><p>Завершён: ${esc(s.finished_at)}; инструкция подтверждена: ${esc(s.instruction_accepted_at)}</p><table><tr><th>Задание</th><th>Ответ студента</th><th>Верный ответ</th></tr>${(s.asked_question_ids ?? []).map(id => (report.questions ?? []).find(q => q.id === id)).filter((q): q is Report["questions"][number] => Boolean(q)).map(q => { const picked = s.answers.find(a => a.question_id === q.id)?.answer_ids ?? []; return `<tr><td>${esc(q.text)}</td><td>${q.answers.filter(a => picked.includes(a.id)).map(a => esc(a.text)).join("; ") || "Нет ответа"}</td><td>${q.answers.filter(a => a.is_correct).map(a => esc(a.text)).join("; ")}</td></tr>`; }).join("")}</table><h2>Журнал действий</h2>${(s.events ?? []).map(e => `<p>${esc(e.at)} · ${esc(e.kind)} ${esc(e.question_id ?? "")} ${esc(e.answer_ids?.join(", ") ?? "")}</p>`).join("")}<p>Ответственный __________________</p></section>`).join("");
    return <div className="flex flex-col gap-5">
  <Card className="p-5"><h2 className="text-xl font-semibold">{report.title}</h2><p className="mt-2 text-sm text-muted-foreground">{report.method}</p></Card>
  <div className="flex flex-wrap gap-2"><Button onClick={() => printHtml(report.title, statement())}>Печать ведомости</Button>{report.questions?.length > 0 && <><Button variant="outline" onClick={() => setSelected(report.students.map(s => s.id))}>Выбрать всех</Button><Button disabled={!selected.length} onClick={() => printHtml("Протоколы", protocols())}>Печать протоколов ({selected.length})</Button></>}</div>
  <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead><tr>{["", "Группа", "ФИО", "Верно", "Оценка", "Рейтинг"].map((h, i) => <th key={i} className="p-3">{h}</th>)}</tr></thead><tbody>{report.students.map(s => <tr key={`${s.session_id}:${s.id}`} className="border-t"><td className="p-3"><input aria-label={`Выбрать ${s.name}`} type="checkbox" checked={selected.includes(s.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))}/></td><td>{s.group}</td><td>{s.name}</td><td>{s.percent.toFixed(2)}%</td><td>{s.grade}</td><td>{s.rank}</td></tr>)}</tbody></table>{!report.students.length && <p className="p-4">Завершённых попыток пока нет</p>}</div>
  <Card className="gap-4 p-5"><label>Сравнение <select className={field} value={kind} onChange={e => setKind(e.target.value)}>{Object.entries({ group: "По группам", specialty: "По специальностям", faculty: "По факультетам", discipline: "По дисциплинам", year: "По годам и сессиям", university: "Университет" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>{summary.map(s => <div key={s.key}><div className="flex justify-between text-sm"><span>{s.key} · {s.count} чел.</span><span>{s.average_percent.toFixed(2)}% · {s.average_grade.toFixed(2)} балла</span></div><div className="mt-2 h-5 rounded bg-muted"><div className="h-5 rounded bg-violet-600" style={{ width: `${s.average_percent}%` }}/></div><p className="mt-1 text-xs">{[5, 4, 3, 2].map(g => `${g}: ${s.grades[g] ?? 0} (${((s.grades[g] ?? 0) / s.count * 100).toFixed(1)}%)`).join(" · ")}</p></div>)}</Card>
  {!!report.items?.length && <Card className="gap-4 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Анализ заданий</h2><Button variant="outline" onClick={() => {
                const node = document.getElementById("exam-v2-item-report");
                if (node)
                    printHtml("Анализ заданий", node.innerHTML);
            }}>Печать анализа</Button></div><div id="exam-v2-item-report"><p className="mb-3 text-xs">{report.method}</p><div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{["Задание / альтернативы", "Выбор", "Дискриминативность", "Сложность", "Корреляция с итогом без задания"].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{report.items.map(item => <tr key={item.id} className="border-t align-top"><td className="p-2"><strong>{item.text}</strong><p className="text-xs">Предъявлений: {item.asked}; пропусков: {item.unanswered}</p>{item.alternatives.map((a, i) => <p className={a.flag ? "bg-purple-100 text-purple-950" : ""} key={i}>{a.correct ? "✓ " : ""}{a.text}</p>)}</td><td className="p-2"><p>—</p><p>&nbsp;</p>{item.alternatives.map((a, i) => <p key={i}>{a.percent.toFixed(1)}% ({a.count})</p>)}</td><td className={`p-2 ${item.discrimination !== null ? (item.discrimination > .6 ? "bg-cyan-100 text-cyan-950" : item.discrimination > .3 ? "bg-yellow-100 text-yellow-950" : "bg-red-100 text-red-950") : ""}`}>{item.discrimination?.toFixed(2) ?? "Недостаточно данных"}</td><td className={`p-2 ${item.asked && (item.difficulty < .05 || item.difficulty > .95) ? "bg-red-100 text-red-950" : ""}`}>{item.asked ? item.difficulty.toFixed(2) : "—"}</td><td className={`p-2 ${item.correlation !== null && item.correlation < .3 ? "bg-red-100 text-red-950" : item.correlation !== null && item.correlation < .4 ? "bg-yellow-100 text-yellow-950" : ""}`}>{item.correlation?.toFixed(2) ?? "Не вычисляется"}</td></tr>)}</tbody></table></div></div></Card>}
 </div>;
}
export default function ExamV2Page() {
    const [banks, setBanks] = useState<Bank[]>([]), [variants, setVariants] = useState<GeneratedVariant[]>([]), [sessions, setSessions] = useState<TestSession[]>([]);
    const [bank, setBank] = useState<Bank>(), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
    const [tab, setTab] = useState("banks"), [report, setReport] = useState<Report>(), [sessionID, setSessionID] = useState(""), [year, setYear] = useState(""), [season, setSeason] = useState("");
    const [preview, setPreview] = useState<TestQuestionInput[]>(), [picked, setPicked] = useState<Record<number, number>>({}), [previewDeadline, setPreviewDeadline] = useState(0), [previewDone, setPreviewDone] = useState(false), [remaining, setRemaining] = useState(0);
    const sessionCreate = useTestSessionCreate(examTestSessionApi, true);
    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError("");
        try {
            await fn();
        }
        catch (e) {
            setError(errorText(e));
        }
        finally {
            setBusy(false);
        }
    };
    const load = async () => { const [r, s] = await Promise.all([client.bankFetch({}), examTestSessionApi.fetch()]); setBanks(r.banks); setVariants(r.variants); setSessions(s.filter(item => item.examV2)); };
    useEffect(() => { void run(load); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!preview || previewDone)
            return;
        const tick = () => {
            const left = Math.max(0, previewDeadline - Date.now());
            setRemaining(left);
            if (left === 0)
                setPreviewDone(true);
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [preview, previewDone, previewDeadline]);
    useEffect(() => {
        if (sessionCreate.created)
            void run(load);
    }, [sessionCreate.created]); // eslint-disable-line react-hooks/exhaustive-deps
    const patch = (values: Partial<Bank>) => { setBank(b => b ? { ...b, ...values, approvedBy: values.approvedBy ?? "" } : b); setDirty(true); };
    const changeSection = (index: number, values: Partial<Bank["sections"][number]>) => {
        if (bank)
            patch({ sections: bank.sections.map((s, i) => i === index ? { ...s, ...values } : s) });
    };
    const changeQuestion = (section: number, index: number, q: TestQuestionInput) => {
        if (bank)
            changeSection(section, { questions: bank.sections[section].questions.map((old, i) => i === index ? q : old) });
    };
    const save = () => run(async () => {
        if (!bank)
            return;
        const result = await client.bankSave({ bank });
        setBank(result.bank);
        setDirty(false);
        await load();
    });
    const importFiles = (index: number, files: File[]) => run(async () => {
        if (!bank || !files.length)
            return;
        const drafts = await Promise.all(files.map(file => examTestBuilderApi.importParse(file)));
        const questions = drafts.flatMap(d => d.form.questions.map(q => create(TestQuestionInputSchema, { text: q.text, image: q.image, answers: q.answers })));
        for (const [i, q] of questions.entries())
            if (q.answers.filter(a => a.isCorrect).length !== 1)
                throw new Error(`Задание ${i + 1}: нужен ровно один правильный ответ. Пакет не добавлен.`);
        const seen = new Set(bank.sections.flatMap(s => s.questions.map(q => q.text.trim().toLocaleLowerCase("ru"))));
        for (const q of questions) {
            const key = q.text.trim().toLocaleLowerCase("ru");
            if (seen.has(key))
                throw new Error(`Повтор вопроса: ${q.text}. Пакет не добавлен.`);
            seen.add(key);
        }
        changeSection(index, { questions: [...bank.sections[index].questions, ...questions] });
    });
    const showReport = () => run(async () => { const r = await client.reportFetch({ sessionId: BigInt(sessionID || 0), academicYear: year, season }); setReport(JSON.parse(r.reportJson) as Report); });
    return <CommonWrapper title="Экзаменационное тестирование V2" description="Банк по разделам · структура вариантов · согласование · расписание · протоколы и статистика">
  <div className="mb-5 flex flex-wrap gap-2">{[["banks", "Банк и структура"], ["variants", "Варианты и расписание"], ["reports", "Отчёты и анализ"]].map(([key, title]) => <Button key={key} variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>{title}</Button>)}<Button variant="ghost" disabled={busy} onClick={() => void run(load)}>Обновить</Button><Button asChild variant="ghost"><Link to={ROUTE.EXAM_TESTS.BUILDER}>Экзамены V1</Link></Button><Button asChild variant="outline"><a href={ROUTE.PUBLIC.EXAM_TESTING} target="_blank" rel="noreferrer">Общая ссылка класса</a></Button></div>
  {error && <p role="alert" className="mb-4 rounded-lg border border-red-400 p-4 text-red-600">{error}</p>}{busy && <p role="status" className="mb-4 text-sm text-muted-foreground">Обработка…</p>}
  {tab === "banks" && <div className="grid gap-5 lg:grid-cols-[280px_1fr]"><Card className="h-fit gap-3 p-4"><Can section={PermissionSection.EXAM_TESTS}><Button disabled={busy} onClick={() => { setBank(fresh()); setDirty(true); }}>Новая дисциплина</Button></Can>{banks.map(b => <button className={`rounded border p-3 text-left text-sm ${bank?.id === b.id ? "border-violet-500" : ""}`} key={String(b.id)} onClick={() => {
                    if (dirty && !confirm("Отменить несохранённые изменения?"))
                        return;
                    setBank(b);
                    setDirty(false);
                }}><strong>{b.discipline}</strong><p>{b.specialty} · {b.semester} семестр</p><p>{b.academicYear} · {b.season === "winter" ? "зима" : "лето"}</p><p>{b.approvedBy ? "Согласован УМР" : "Черновик"}</p></button>)}{!banks.length && <p className="text-sm text-muted-foreground">Создайте дисциплину и загрузите задания в её разделы.</p>}</Card>
  {bank && <Card className="gap-5 p-5"><div className="grid gap-4 md:grid-cols-2"><label>Специальность<input list="exam-specialties" className={field} value={bank.specialty} onChange={e => patch({ specialty: e.target.value })}/><datalist id="exam-specialties">{[...new Set([...specialties, ...banks.map(b => b.specialty)])].map(s => <option key={s} value={s}/>)}</datalist></label><label>Факультет<input className={field} value={bank.faculty} onChange={e => patch({ faculty: e.target.value })}/></label><label>Дисциплина<input className={field} value={bank.discipline} onChange={e => patch({ discipline: e.target.value })}/></label><label>Семестр<input type="number" min={1} max={12} className={field} value={bank.semester} onChange={e => patch({ semester: number(e.target.value) })}/></label><label>Учебный год<input className={field} value={bank.academicYear} onChange={e => patch({ academicYear: e.target.value })}/></label><label>Сессия<select className={field} value={bank.season} onChange={e => patch({ season: e.target.value })}><option value="winter">Зимняя</option><option value="summer">Летняя</option></select></label><label>Время, минут<input type="number" min={1} max={600} className={field} value={bank.durationMinutes} onChange={e => patch({ durationMinutes: number(e.target.value) })}/></label><label>Количество вариантов<input type="number" min={1} max={100} className={field} value={bank.variantCount} onChange={e => patch({ variantCount: number(e.target.value) })}/></label><label className="flex items-center gap-2"><input type="checkbox" checked={bank.showResult} onChange={e => patch({ showResult: e.target.checked })}/>Показать студенту результат</label></div>
  <div className="grid gap-3 md:grid-cols-3">{([['excellent', 'Отлично, от %'], ['good', 'Хорошо, от %'], ['satisfactory', 'Удовлетворительно, от %']] as const).map(([key, label]) => <label key={key}>{label}<input className={field} type="number" min={1} max={100} value={bank[key]} onChange={e => patch({ [key]: number(e.target.value) })}/></label>)}</div>
  <h2 className="font-semibold">Структура варианта: {bank.sections.reduce((sum, s) => sum + s.quota, 0)} заданий</h2>
  {bank.sections.map((section, index) => <div key={index} className="flex flex-col gap-3 rounded-lg border p-4"><div className="grid gap-2 md:grid-cols-[1fr_140px_auto]"><label>Раздел<input className={field} value={section.name} onChange={e => changeSection(index, { name: e.target.value })}/></label><label>Заданий в варианте<input className={field} type="number" min={0} max={section.questions.length} value={section.quota} onChange={e => changeSection(index, { quota: number(e.target.value) })}/></label><Can section={PermissionSection.EXAM_TESTS}><Button variant="ghost" onClick={() => patch({ sections: bank.sections.filter((_, i) => i !== index) })}>Удалить раздел</Button></Can></div><p className="text-sm">В банке: {section.questions.length}. Внутри одного варианта задания не повторяются; между вариантами возможны пересечения.</p><Can section={PermissionSection.EXAM_TESTS}><label className="text-sm">Пакетный импорт .txt / .docx<input type="file" accept=".txt,.docx" multiple disabled={busy} className={field} onChange={e => { void importFiles(index, Array.from(e.target.files ?? [])); e.target.value = ""; }}/></label><Button variant="outline" onClick={() => changeSection(index, { questions: [...section.questions, newQuestion()] })}>Добавить задание</Button></Can><details><summary className="cursor-pointer">Просмотр и редактирование ({section.questions.length})</summary><div className="mt-3 flex max-h-[560px] flex-col gap-4 overflow-auto">{section.questions.map((q, qi) => <div key={qi} className="rounded border p-3"><textarea aria-label={`Вопрос ${qi + 1}`} className={field} rows={2} value={q.text} onChange={e => changeQuestion(index, qi, { ...q, text: e.target.value })}/>{q.answers.map((a, ai) => <div className="mt-2 flex items-center gap-2" key={ai}><input aria-label={`Верный ответ ${ai + 1}`} type="radio" name={`correct-${index}-${qi}`} checked={a.isCorrect} onChange={() => changeQuestion(index, qi, { ...q, answers: q.answers.map((old, i) => ({ ...old, isCorrect: i === ai })) })}/><input className={field} value={a.text} onChange={e => changeQuestion(index, qi, { ...q, answers: q.answers.map((old, i) => i === ai ? { ...old, text: e.target.value } : old) })}/><Button variant="ghost" disabled={q.answers.length <= 2} onClick={() => changeQuestion(index, qi, { ...q, answers: q.answers.filter((_, i) => i !== ai) })}>×</Button></div>)}<div className="mt-2 flex gap-2"><Button variant="ghost" disabled={q.answers.length >= 30} onClick={() => changeQuestion(index, qi, { ...q, answers: [...q.answers, create(TestAnswerInputSchema, { text: "", isCorrect: false })] })}>Добавить ответ</Button><Button variant="ghost" onClick={() => changeSection(index, { questions: section.questions.filter((_, i) => i !== qi) })}>Удалить задание</Button></div></div>)}</div></details></div>)}
  <Can section={PermissionSection.EXAM_TESTS}><Button variant="outline" onClick={() => patch({ sections: [...bank.sections, create(BankSectionSchema, { name: `Раздел ${bank.sections.length + 1}`, quota: 0 })] })}>Добавить раздел</Button><label>Заключение специалиста УМР<textarea className={field} value={bank.reviewNotes} onChange={e => patch({ reviewNotes: e.target.value })}/></label><label>Замечания ИИ<textarea className={field} readOnly value={bank.aiReviewNotes} placeholder="Провайдер настраивается администратором. Проверка структуры выполняется при сохранении."/></label><Button variant="outline" disabled={busy || dirty || bank.id === 0n} onClick={() => void run(async () => { const r = await client.aIReviewFetch({ bankId: bank.id, revision: bank.revision }); patch({ aiReviewNotes: r.notes }); })}>Запросить ИИ-проверку сохранённого банка</Button><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(bank.approvedBy)} onChange={e => patch({ approvedBy: e.target.checked ? "approve" : "" })}/>Согласовано специалистом УМР (автор согласования фиксируется автоматически)</label><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void save()}>Сохранить банк</Button><Button variant="outline" disabled={busy || dirty || !bank.approvedBy || bank.id === 0n} onClick={() => void run(async () => { await client.variantsGenerate({ bankId: bank.id, revision: bank.revision }); await load(); setTab("variants"); })}>Сформировать варианты</Button>{bank.id > 0n && <Button variant="destructive" disabled={busy} onClick={() => {
                        if (confirm("Удалить банк? Уже выданные сессии и их результаты сохранятся."))
                            void run(async () => { await client.bankDelete({ id: bank.id, revision: bank.revision }); setBank(undefined); await load(); });
                    }}>Удалить банк</Button>}</div></Can></Card>}</div>}
  {tab === "variants" && <div className="flex flex-col gap-5"><Card className="p-4 text-sm">Назначьте готовый вариант курсу, группе или студентам из MDM. Студенты используют одну общую ссылку и номер зачётки. Каждая новая сессия даёт отдельную попытку. Пробный студент доступен только преподавателю и не попадает в результаты.</Card>{variants.map(v => <Card key={String(v.id)} className="flex flex-row flex-wrap items-center justify-between gap-3 p-4"><div><h2 className="font-semibold">{v.title}</h2><p className="text-sm text-muted-foreground">{v.durationMinutes} мин · результат {v.showResult ? "показывается" : "сообщит преподаватель"}</p></div><Can section={PermissionSection.EXAM_TESTS}><div className="flex gap-2"><Button disabled={busy} onClick={() => void run(async () => { const p = await client.previewFetch({ testId: v.testId }); sessionCreate.open({ id: String(v.testId), topic: v.title, questionCount: p.questions.length, mixed: false }); sessionCreate.form.setValue("durationMinutes", String(v.durationMinutes)); sessionCreate.form.setValue("questionCount", ""); sessionCreate.form.setValue("showResult", v.showResult); })}>Назначить / расписание</Button><Button variant="outline" disabled={busy} onClick={() => void run(async () => { const p = await client.previewFetch({ testId: v.testId }); setPreview(p.questions); setPicked({}); setPreviewDone(false); setPreviewDeadline(Date.now() + v.durationMinutes * 60000); })}>Пробный студент</Button></div></Can></Card>)}<h2 className="text-xl font-semibold">Выданные сессии V2</h2>{sessions.map(s => <Card key={s.id} className="flex flex-row flex-wrap items-center justify-between p-4"><div><Link className="font-semibold underline" to={ROUTE.EXAM_TESTS.SESSION_RESULTS.replace(":id", s.id)}>{s.topic}</Link><p className="text-sm">Назначено: {s.assignedCount ?? 0} · попыток: {s.attemptCount} · {s.opensAt?.toLocaleString() ?? "сразу"} — {s.closesAt?.toLocaleString() ?? "без даты закрытия"} · {s.isOpen ? "приём открыт" : "закрыт"}</p></div><Button variant="outline" onClick={() => { setSessionID(s.id); setTab("reports"); void run(async () => { const r = await client.reportFetch({ sessionId: BigInt(s.id) }); setReport(JSON.parse(r.reportJson) as Report); }); }}>Ведомость / анализ</Button></Card>)}</div>}
  {preview && <Card className="my-5 gap-4 border-violet-400 p-5"><h2 className="font-semibold">Пробный студент — {previewDone ? `верно ${preview.filter((q, i) => q.answers[picked[i]]?.isCorrect).length} из ${preview.length}` : `осталось ${Math.ceil(remaining / 60000)} мин`}</h2>{preview.map((q, i) => <fieldset disabled={previewDone} key={i}><legend>{i + 1}. {q.text}</legend>{q.answers.map((a, ai) => <label key={ai} className="mt-2 flex gap-2"><input type="radio" name={`preview-${i}`} checked={picked[i] === ai} onChange={() => setPicked(p => ({ ...p, [i]: ai }))}/>{a.text}{previewDone && a.isCorrect && " ✓"}</label>)}</fieldset>)}<div className="flex gap-2"><Button disabled={previewDone} onClick={() => setPreviewDone(true)}>Завершить пробу</Button><Button variant="outline" onClick={() => setPreview(undefined)}>Закрыть пробного студента</Button></div></Card>}
  {tab === "reports" && <div className="flex flex-col gap-5"><Card className="gap-3 p-4"><label>Сессия<select className={field} value={sessionID} onChange={e => setSessionID(e.target.value)}><option value="">Сводный отчёт всех сессий V2</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.topic} · {s.createdAt?.toLocaleString()}</option>)}</select></label>{!sessionID && <div className="flex gap-3"><input className={field} value={year} onChange={e => setYear(e.target.value)} placeholder="Все учебные годы"/><select className={field} value={season} onChange={e => setSeason(e.target.value)}><option value="">Обе сессии</option><option value="winter">Зимняя</option><option value="summer">Летняя</option></select></div>}<Button disabled={busy} onClick={() => void showReport()}>Сформировать отчёт</Button></Card>{report && <ReportView key={`${sessionID}:${report.title}`} report={report}/>}</div>}
  <TestSessionCreateModal state={sessionCreate} exam examV2/>
 </CommonWrapper>;
}
export function MyExamResultsPage() {
    const [rows, setRows] = useState<{
        topic: string;
        show_result: boolean;
        score: number | null;
        total: number | null;
        finished_at: string;
    }[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true);
    useEffect(() => { void ownClient.resultsFetch({}).then(r => setRows(JSON.parse(r.reportJson))).catch(e => setError(errorText(e))).finally(() => setLoading(false)); }, []);
    return <CommonWrapper title="Мои результаты экзаменов" description="Результаты проведённых сессий экзаменационного тестирования V2">{loading && <p>Загрузка…</p>}{error && <p role="alert">{error}</p>}{!loading && !error && !rows.length && <p>Завершённых экзаменов пока нет.</p>}<div className="flex flex-col gap-3">{rows.map((r, i) => <Card className="p-4" key={i}><h2 className="font-semibold">{r.topic}</h2><p>{r.show_result ? `${r.score} из ${r.total}` : "Результат сообщит преподаватель"}</p><p className="text-sm text-muted-foreground">{r.finished_at && new Date(r.finished_at).toLocaleString()}</p></Card>)}</div></CommonWrapper>;
}
