import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { createClient, ConnectError } from "@connectrpc/connect";
import { ExamTestSessionService } from "@fesmu/contract/fesmu/exam/service/v1/exam_test_session.service_pb";
import type { UserDirectoryEntry, UserDirectoryStudentFacet } from "@fesmu/contract/mdm/service/user_directory.service_pb";
import { connectTransport } from "@/shared/config/api";
import { Button } from "@/shared/ui/button";
import type { TestSessionForm } from "./test-session.schema";
const client = createClient(ExamTestSessionService, connectTransport);
const selectClass = "w-full rounded-md border bg-background p-2 text-sm";
export function ExamAudienceFields() {
    const form = useFormContext<TestSessionForm>();
    const a = useWatch({ control: form.control, name: "audience" });
    const [query, setQuery] = useState("");
    const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
    const [facets, setFacets] = useState<UserDirectoryStudentFacet[]>([]);
    const [total, setTotal] = useState(0);
    const [next, setNext] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [labels, setLabels] = useState<Record<string, string>>({});
    const [retry, setRetry] = useState(0);
    const load = async (offset: number, append: boolean, signal?: AbortSignal) => {
        setBusy(true);
        setError("");
        try {
            const result = await client.examAudienceFetch({ query, facultyCode: Number(a.facultyCode), course: Number(a.course), studentGroup: a.studentGroup, limit: 50, offset, includeFacets: true }, { signal });
            if (signal?.aborted)
                return;
            setUsers(old => append ? [...old, ...result.users] : result.users);
            setFacets(result.studentFacets);
            setTotal(Number(result.total));
            setNext(result.nextOffset);
            setLabels(old => ({ ...old, ...Object.fromEntries(result.users.map(u => [u.uuid, u.fullName])) }));
        }
        catch (err) {
            if (!signal?.aborted)
                setError(err instanceof ConnectError ? err.rawMessage : "Не удалось запросить студентов MDM");
        }
        finally {
            if (!signal?.aborted)
                setBusy(false);
        }
    };
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => void load(0, false, controller.signal), 250);
        return () => { clearTimeout(timer); controller.abort(); };
        // A single filtered request supplies people and all student selector facets.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, a.facultyCode, a.course, a.studentGroup, retry]);
    const faculties = [...new Map(facets.map(f => [f.facultyCode, f.facultyName || `Факультет ${f.facultyCode}`])).entries()].filter(([code]) => code > 0);
    const selectedFacets = facets.filter(f => !a.facultyCode || f.facultyCode === Number(a.facultyCode));
    const courses = [...new Set(selectedFacets.map(f => f.course))].filter(c => c > 0).sort();
    const groups = [...new Set(selectedFacets.filter(f => !a.course || f.course === Number(a.course)).map(f => f.group))].filter(Boolean).sort((x, y) => x.localeCompare(y, "ru", { numeric: true }));
    const reset = (name: "facultyCode" | "course", value: string) => {
        form.setValue(`audience.${name}`, value);
        if (name === "facultyCode")
            form.setValue("audience.course", "");
        form.setValue("audience.studentGroup", "");
    };
    const toggle = (uuid: string) => form.setValue("audience.studentUuids", a.studentUuids.includes(uuid) ? a.studentUuids.filter(id => id !== uuid) : [...a.studentUuids, uuid], { shouldValidate: true });
    const errors = form.formState.errors.audience;
    return <fieldset className="flex flex-col gap-3 rounded-xl border p-4">
  <legend className="px-1 font-semibold">Кому назначить экзамен</legend>
  <label className="text-sm">Назначение
   <select className={selectClass} {...form.register("audience.kind")} onChange={e => { form.setValue("audience", { kind: e.target.value as TestSessionForm["audience"]["kind"], facultyCode: "", course: "", studentGroup: "", studentUuids: [] }); setQuery(""); }}>
    <option value="course">Всему курсу факультета</option><option value="group">Учебной группе</option><option value="students">Определённым студентам</option>
   </select>
  </label>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="text-sm">Факультет
    <select className={selectClass} value={a.facultyCode} onChange={e => reset("facultyCode", e.target.value)}><option value="">Выберите факультет</option>{faculties.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
   </label>
   <label className="text-sm">Курс
    <select className={selectClass} value={a.course} onChange={e => reset("course", e.target.value)}><option value="">{a.kind !== "students" ? "Выберите курс" : "Все курсы"}</option>{courses.map(c => <option key={c} value={c}>{c} курс</option>)}</select>
   </label>
  </div>
  {a.kind !== "course" && <label className="text-sm">Группа
   <select className={selectClass} {...form.register("audience.studentGroup")}><option value="">{a.kind === "group" ? "Выберите группу" : "Все группы"}</option>{groups.map(g => <option key={g} value={g}>{g}</option>)}</select>
  </label>}
  {a.kind === "students" && <>
   <label className="text-sm">Поиск студента в MDM<input className={selectClass} value={query} onChange={e => setQuery(e.target.value)} placeholder="Фамилия, имя или отчество" maxLength={100}/></label>
   {!!a.studentUuids.length && <div className="flex flex-wrap gap-2">{a.studentUuids.map(id => <Button key={id} type="button" variant="secondary" size="sm" onClick={() => toggle(id)}>{labels[id] || "Студент"} ×</Button>)}</div>}
   <div className="max-h-60 overflow-y-auto rounded-md border" aria-busy={busy}>
    {users.map(user => <label key={user.uuid} className="flex cursor-pointer items-start gap-2 border-b p-2 text-sm last:border-0">
     <input type="checkbox" className="mt-1" checked={a.studentUuids.includes(user.uuid)} disabled={!a.studentUuids.includes(user.uuid) && a.studentUuids.length >= 200} onChange={() => toggle(user.uuid)}/>
     <span>{user.fullName}<span className="block text-xs text-muted-foreground">{user.students.map(s => `${s.facultyName} · ${s.course} курс · ${s.group}`).join("; ")}</span></span>
    </label>)}
    {!busy && !users.length && <p className="p-3 text-sm text-muted-foreground">Студенты не найдены</p>}
   </div>
   {next > 0 && <Button type="button" variant="outline" disabled={busy} onClick={() => void load(next, true)}>Показать ещё</Button>}
  </>}
  {!busy && !error && total===0 && !query && !a.facultyCode && !a.course && !a.studentGroup && <p role="status" className="text-sm text-muted-foreground">В этом MDM не найдены доступные учебные записи студентов. Проверьте, что список студентов загружен в нужное окружение MDM.</p>}
  {busy && <p className="text-sm text-muted-foreground" role="status">Запрашиваем MDM…</p>}
  {error ? <div role="alert" className="text-sm text-destructive">{error} <Button type="button" size="sm" variant="outline" onClick={() => setRetry(v => v + 1)}>Повторить</Button></div> : <p className="text-sm text-muted-foreground">{a.kind === "students" ? `Выбрано студентов: ${a.studentUuids.length}` : `По фильтрам MDM найдено студентов: ${total}`}</p>}
  {[errors?.kind, errors?.facultyCode, errors?.course, errors?.studentGroup, errors?.studentUuids].map((err, i) => err?.message ? <p key={i} role="alert" className="text-sm text-destructive">{err.message}</p> : null)}
  <p className="text-xs text-muted-foreground">Будет сохранён текущий список выбранных студентов по UUID MDM. На общей странице студент вводит номер зачётки и видит только назначенные ему экзамены.</p>
 </fieldset>;
}
