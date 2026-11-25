import { statementDocument, statementStudents } from "./exam-v2/statement";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  generationBlocker,
  generateSavedVariants,
  isReadyExam,
  variantsForBank,
} from "./exam-v2/generation";
import { Link } from "react-router-dom";
import { createClient, ConnectError } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  ExamBankService,
  ExamStudentService,
  BankSchema,
  BankSectionSchema,
  BankTopicSchema,
} from "@fesmu/contract/fesmu/exam/service/v2/exam_bank.service_pb";
import type {
  Bank,
  BankTopic,
  GeneratedVariant,
} from "@fesmu/contract/fesmu/exam/service/v2/exam_bank.service_pb";
import { TestQuestionInputSchema } from "@fesmu/contract/fesmu/service/v1/test.service_pb";
import type { TestQuestionInput } from "@fesmu/contract/fesmu/service/v1/test.service_pb";
import { connectTransport } from "@/shared/config/api";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { CommonWrapper } from "@/shared/components/wrapper";
import { examTestBuilderApi } from "@/widgets/test-builder";
import {
  TestSessionCreateModal,
  examTestSessionApi,
  useTestSessionCreate,
} from "@/widgets/test-session";
import type { TestSession } from "@/widgets/test-session/test-session.schema";
import { Can } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
import { SectionEditor, sectionQuestions } from "./exam-v2/SectionEditor";
import type { SourceTest } from "./exam-v2/SectionEditor";
import { validateImportedTopic } from "./exam-v2/question-validation";
const client = createClient(ExamBankService, connectTransport);
const ownClient = createClient(ExamStudentService, connectTransport);
const specialties = [
  "Лечебное дело",
  "Педиатрия",
  "Стоматология",
  "Фармация",
  "Медицинская биохимия",
  "Клиническая психология",
  "Социальная работа",
  "Сестринское дело",
  "Фармация медико-фармацевтического колледжа",
  "Стоматология профилактическая медико-фармацевтического колледжа",
];
const field = "w-full rounded-md border bg-background p-2 text-sm";
const errorText = (e: unknown) =>
  e instanceof ConnectError
    ? e.rawMessage
    : e instanceof Error
      ? e.message
      : "Не удалось выполнить действие";
const fresh = () =>
  create(BankSchema, {
    specialty: "Педиатрия",
    faculty: "Педиатрический факультет",
    semester: 3,
    academicYear: "2026/2027",
    season: "winter",
    variantCount: 1,
    durationMinutes: 20,
    excellent: 90,
    good: 80,
    satisfactory: 70,
    sections: [],
  });
const number = (value: string) => Number(value) || 0;
const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
function printHtml(title: string, html: string, fullDocument = false) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Разрешите открытие окна для печати");
    return;
  }
  w.document.write(
    fullDocument
      ? html
      : `<html lang="ru"><head><title>${esc(title)}</title><style>body{font:12px Arial;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px;text-align:left}h1{font-size:20px}.page{break-after:page}button,input{display:none}@media print{.page:last-child{break-after:auto}}</style></head><body>${html}</body></html>`,
  );
  w.document.close();
  w.focus();
  void w.document.fonts.ready.then(() => {
    w.print();
  });
}
type StudentRow = {
  test_title?: string;
  test_id?: number;
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
    semester?: number;
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
  settings?: StudentRow["settings"];
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
function ReportView({ report }: { report: Report }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [kind, setKind] = useState("group");
  const summary = report.summaries?.[kind] ?? [];
  const groupOptions = [...new Set(report.students.map((s) => s.group))].sort((a, b) =>
    a.localeCompare(b, "ru", { numeric: true }),
  );
  const [statementGroups, setStatementGroups] = useState<string[]>(groupOptions);
  const visibleStudents = statementStudents(report.students, statementGroups);
  useEffect(() => {
    setSelected([]);
  }, [statementGroups]);

  const protocols = () =>
    report.students
      .filter((s) => selected.includes(s.id))
      .map(
        (s) =>
          `<section class="page"><h1>Протокол тестирования</h1><p>${esc(report.title)} · ${esc(s.name)} · группа ${esc(s.group)}</p><p>${s.score}/${s.total} · ${s.percent.toFixed(2)}% · оценка ${s.grade}</p><p>Завершён: ${esc(s.finished_at)}; инструкция подтверждена: ${esc(s.instruction_accepted_at)}</p><table><tr><th>Задание</th><th>Ответ студента</th><th>Верный ответ</th></tr>${(
            s.asked_question_ids ?? []
          )
            .map((id) => (report.questions ?? []).find((q) => q.id === id))
            .filter((q): q is Report["questions"][number] => Boolean(q))
            .map((q) => {
              const picked = s.answers.find((a) => a.question_id === q.id)?.answer_ids ?? [];
              return `<tr><td>${esc(q.text)}</td><td>${
                q.answers
                  .filter((a) => picked.includes(a.id))
                  .map((a) => esc(a.text))
                  .join("; ") || "Нет ответа"
              }</td><td>${q.answers
                .filter((a) => a.is_correct)
                .map((a) => esc(a.text))
                .join("; ")}</td></tr>`;
            })
            .join(
              "",
            )}</table><h2>Журнал действий</h2>${(s.events ?? []).map((e) => `<p>${esc(e.at)} · ${esc(e.kind)} ${esc(e.question_id ?? "")} ${esc(e.answer_ids?.join(", ") ?? "")}</p>`).join("")}<p>Ответственный __________________</p></section>`,
      )
      .join("");
  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="text-xl font-semibold">{report.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{report.method}</p>
      </Card>
      <fieldset className="rounded-lg border p-4">
        <legend className="px-1 font-medium">Группы для общей ведомости</legend>
        <p className="mb-3 text-sm text-muted-foreground">
          Отметьте группы: студенты попадут в одну ведомость с общим рейтингом и итогами по каждой
          группе.
        </p>
        <div className="flex flex-wrap gap-4">
          {groupOptions.map((group) => (
            <label key={group} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={statementGroups.includes(group)}
                onChange={(e) =>
                  setStatementGroups((previous) =>
                    e.target.checked
                      ? [...previous, group]
                      : previous.filter((value) => value !== group),
                  )
                }
              />
              {group || "Без группы"}
            </label>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setStatementGroups(groupOptions)}>
          Выбрать все группы
        </Button>
      </fieldset>
      <p className="text-sm text-muted-foreground">
        Формат образца: Times New Roman, 10 пт, A4. В окне печати выберите масштаб 100% и отключите
        колонтитулы браузера.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!visibleStudents.length}
          onClick={() => printHtml(report.title, statementDocument(report, statementGroups), true)}
        >
          Печать ведомости
        </Button>
        {report.questions?.length > 0 && (
          <>
            <Button variant="outline" onClick={() => setSelected(visibleStudents.map((s) => s.id))}>
              Выбрать всех
            </Button>
            <Button disabled={!selected.length} onClick={() => printHtml("Протоколы", protocols())}>
              Печать протоколов ({selected.length})
            </Button>
          </>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["", "Группа", "ФИО", "Верно", "Оценка", "Рейтинг"].map((h, i) => (
                <th key={i} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleStudents.map((s) => (
              <tr key={`${s.session_id}:${s.id}`} className="border-t">
                <td className="p-3">
                  <input
                    aria-label={`Выбрать ${s.name}`}
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                      )
                    }
                  />
                </td>
                <td>{s.group}</td>
                <td>{s.name}</td>
                <td>{s.percent.toFixed(2)}%</td>
                <td>{s.grade}</td>
                <td>{s.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleStudents.length && (
          <p className="p-4">Нет завершённых попыток в выбранных группах</p>
        )}
      </div>
      <Card className="gap-4 p-5">
        <label>
          Сравнение{" "}
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries({
              group: "По группам",
              specialty: "По специальностям",
              faculty: "По факультетам",
              discipline: "По дисциплинам",
              year: "По годам и сессиям",
              university: "Университет",
            }).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {summary.map((s) => (
          <div key={s.key}>
            <div className="flex justify-between text-sm">
              <span>
                {s.key} · {s.count} чел.
              </span>
              <span>
                {s.average_percent.toFixed(2)}% · {s.average_grade.toFixed(2)} балла
              </span>
            </div>
            <div className="mt-2 h-5 rounded bg-muted">
              <div
                className="h-5 rounded bg-violet-600"
                style={{ width: `${s.average_percent}%` }}
              />
            </div>
            <p className="mt-1 text-xs">
              {[5, 4, 3, 2]
                .map(
                  (g) =>
                    `${g}: ${s.grades[g] ?? 0} (${(((s.grades[g] ?? 0) / s.count) * 100).toFixed(1)}%)`,
                )
                .join(" · ")}
            </p>
          </div>
        ))}
      </Card>
      {!!report.items?.length && (
        <Card className="gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Анализ заданий</h2>
            <Button
              variant="outline"
              onClick={() => {
                const node = document.getElementById("exam-v2-item-report");
                if (node) printHtml("Анализ заданий", node.innerHTML);
              }}
            >
              Печать анализа
            </Button>
          </div>
          <div id="exam-v2-item-report">
            <p className="mb-3 text-xs">{report.method}</p>
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Задание / альтернативы",
                      "Выбор",
                      "Дискриминативность",
                      "Сложность",
                      "Корреляция с итогом без задания",
                    ].map((h) => (
                      <th key={h} className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((item) => (
                    <tr key={item.id} className="border-t align-top">
                      <td className="p-2">
                        <strong>{item.text}</strong>
                        <p className="text-xs">
                          Предъявлений: {item.asked}; пропусков: {item.unanswered}
                        </p>
                        {item.alternatives.map((a, i) => (
                          <p className={a.flag ? "bg-purple-100 text-purple-950" : ""} key={i}>
                            {a.correct ? "✓ " : ""}
                            {a.text}
                          </p>
                        ))}
                      </td>
                      <td className="p-2">
                        <p>—</p>
                        <p>&nbsp;</p>
                        {item.alternatives.map((a, i) => (
                          <p key={i}>
                            {a.percent.toFixed(1)}% ({a.count})
                          </p>
                        ))}
                      </td>
                      <td
                        className={`p-2 ${item.discrimination !== null ? (item.discrimination > 0.6 ? "bg-cyan-100 text-cyan-950" : item.discrimination > 0.3 ? "bg-yellow-100 text-yellow-950" : "bg-red-100 text-red-950") : ""}`}
                      >
                        {item.discrimination?.toFixed(2) ?? "Недостаточно данных"}
                      </td>
                      <td
                        className={`p-2 ${item.asked && (item.difficulty < 0.05 || item.difficulty > 0.95) ? "bg-red-100 text-red-950" : ""}`}
                      >
                        {item.asked ? item.difficulty.toFixed(2) : "—"}
                      </td>
                      <td
                        className={`p-2 ${item.correlation !== null && item.correlation < 0.3 ? "bg-red-100 text-red-950" : item.correlation !== null && item.correlation < 0.4 ? "bg-yellow-100 text-yellow-950" : ""}`}
                      >
                        {item.correlation?.toFixed(2) ?? "Не вычисляется"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
export default function ExamV2Page() {
  const [banks, setBanks] = useState<Bank[]>([]),
    [variants, setVariants] = useState<GeneratedVariant[]>([]),
    [sessions, setSessions] = useState<TestSession[]>([]);
  const [bank, setBank] = useState<Bank | undefined>(() => fresh()),
    [dirty, setDirty] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [tab, setTab] = useState("create"),
    [report, setReport] = useState<Report>(),
    [sessionID, setSessionID] = useState(""),
    [reportTestID, setReportTestID] = useState(""),
    [year, setYear] = useState(""),
    [season, setSeason] = useState("");
  const [preview, setPreview] = useState<TestQuestionInput[]>(),
    [picked, setPicked] = useState<Record<number, number>>({}),
    [previewDeadline, setPreviewDeadline] = useState(0),
    [previewDone, setPreviewDone] = useState(false),
    [remaining, setRemaining] = useState(0);
  const sessionCreate = useTestSessionCreate(examTestSessionApi, true);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const load = async () => {
    const [r, s] = await Promise.all([client.bankFetch({}), examTestSessionApi.fetch()]);
    setBanks(r.banks);
    setVariants(r.variants);
    setSessions(s.filter((item) => item.examV2));
  };
  useEffect(() => {
    void run(load);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!preview || previewDone) return;
    const tick = () => {
      const left = Math.max(0, previewDeadline - Date.now());
      setRemaining(left);
      if (left === 0) setPreviewDone(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [preview, previewDone, previewDeadline]);
  useEffect(() => {
    if (sessionCreate.created) void run(load);
  }, [sessionCreate.created]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (values: Partial<Bank>) => {
    setBank((b) => (b ? { ...b, ...values } : b));
    setDirty(true);
  };
  const changeSection = (index: number, values: Partial<Bank["sections"][number]>) => {
    if (bank)
      patch({
        sections: bank.sections.map((s, i) => {
          if (i !== index) return s;
          const changed = { ...s, ...values };
          return changed.readyVariant
            ? { ...changed, quota: sectionQuestions(changed).length }
            : changed;
        }),
      });
  };
  const persistBank = async (draft: Bank) => {
    const response = await client.bankSave({ bank: draft });
    if (!response.bank) throw new Error("Сервис не вернул сохранённый банк.");
    setBank(response.bank);
    setDirty(false);
    return response.bank;
  };
  const save = () =>
    run(async () => {
      if (!bank) return;
      if (isReadyExam(bank)) {
        await publishReadyExam();
        return;
      }
      await persistBank(bank);
      toast.success("Банк сохранён");
      setTab("banks");
      await load();
    });
  const publishReadyExam = async () => {
    if (!bank) throw new Error(generationBlocker(bank));
    const result = await generateSavedVariants(bank, dirty, {
      save: persistBank,
      generate: async (id, revision) =>
        (await client.variantsGenerate({ bankId: id, revision })).variants,
    });
    setVariants((previous) => [
      ...result.variants,
      ...previous.filter((v) => !result.variants.some((created) => created.id === v.id)),
    ]);
    setTab("variants");
    toast.success(
      `${isReadyExam(result.bank) ? `Сохранено готовых тестов: ${result.variants.length}.` : `Сформировано вариантов: ${result.variants.length}.`} Теперь можно назначить экзамен студентам.`,
    );
    try {
      await load();
    } catch (error) {
      const message = "Варианты созданы, но обновить общий список не удалось: " + errorText(error);
      setError(message);
      toast.error(message);
    }
  };
  const generate = () => run(publishReadyExam);
  const readyExam = isReadyExam(bank);
  const bankVariants = variantsForBank(variants, bank);
  const visibleVariants = bankVariants;
  const visibleSessions = sessions.filter(
    (session) =>
      !session.testId || bankVariants.some((variant) => String(variant.testId) === session.testId),
  );
  const blockedGeneration = generationBlocker(bank);
  const generationLabel = readyExam
    ? "Сохранить готовые тесты"
    : dirty || bank?.id === 0n
      ? "Сохранить и сформировать варианты"
      : "Сформировать варианты";
  const bankRef = useRef(bank);
  bankRef.current = bank;
  const [sources, setSources] = useState<SourceTest[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionQuota, setSectionQuota] = useState("5");
  const loadSources = () =>
    run(async () => {
      if (sourcesLoaded) return;
      const tests = await examTestBuilderApi.fetch();
      setSources(
        tests.map((test) => ({
          id: test.id,
          title: test.topic,
          questions: test.questions.map((q) =>
            create(TestQuestionInputSchema, {
              text: q.text,
              image: q.image?.hash,
              answers: q.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })),
            }),
          ),
        })),
      );
      setSourcesLoaded(true);
    });
  const addQuestions = (sectionIndex: number, newTopics: BankTopic[], topicIndex?: number) => {
    if (!bank) return;
    if (bankRef.current !== bank)
      throw new Error("Банк изменился во время загрузки. Повторите импорт для текущей редакции.");
    const incoming = newTopics.flatMap((topic) => topic.questions);
    const section = bank.sections[sectionIndex];
    for (const topic of newTopics) {
      // Keep the file/test name and file-local index visible in errors even
      // when importing a package into one existing topic.
      validateImportedTopic(topic.questions, section.name, topic.name);
    }
    if (topicIndex !== undefined) {
      changeSection(sectionIndex, {
        topics: section.topics.map((old, i) =>
          i === topicIndex ? { ...old, questions: [...old.questions, ...incoming] } : old,
        ),
      });
    } else {
      const used = new Set(
        section.topics.map((topic) => topic.name.trim().toLocaleLowerCase("ru")),
      );
      const topics = newTopics.map((topic) => {
        let name = topic.name.trim() || "Импортированный тест";
        for (let suffix = 2; used.has(name.toLocaleLowerCase("ru")); suffix++)
          name = `${topic.name.trim() || "Импортированный тест"} (${suffix})`;
        used.add(name.toLocaleLowerCase("ru"));
        return { ...topic, name };
      });
      changeSection(sectionIndex, { topics: [...section.topics, ...topics] });
    }
  };
  const readTopics = async (files: File[]) =>
    Promise.all(
      files.map(async (file) => {
        const draft = await examTestBuilderApi.importParse(file);
        return create(BankTopicSchema, {
          name: file.name.replace(/\.(txt|docx)$/i, ""),
          questions: draft.form.questions.map((q) =>
            create(TestQuestionInputSchema, { text: q.text, image: q.image, answers: q.answers }),
          ),
        });
      }),
    );
  const importFiles = (sectionIndex: number, files: File[], topicIndex?: number) =>
    run(async () => {
      if (!bank || !files.length) return;
      addQuestions(sectionIndex, await readTopics(files), topicIndex);
    });
  const importReadySections = (files: File[]) =>
    run(async () => {
      if (!bank || !files.length) return;
      const topics = await readTopics(files);
      if (bankRef.current !== bank)
        throw new Error("Банк изменился во время загрузки. Повторите импорт для текущей редакции.");
      const names = new Set(
        bank.sections.map((section) => section.name.trim().toLocaleLowerCase("ru")),
      );
      const sections = topics.map((topic) => {
        if (!topic.questions.length)
          throw new Error(`Файл «${topic.name}» не содержит вопросов. Пакет не добавлен.`);
        validateImportedTopic(topic.questions, topic.name, topic.name);
        let name = topic.name.trim() || "Готовый раздел";
        for (let n = 2; names.has(name.toLocaleLowerCase("ru")); n++)
          name = `${topic.name.trim() || "Готовый раздел"} (${n})`;
        names.add(name.toLocaleLowerCase("ru"));
        return create(BankSectionSchema, {
          name,
          readyVariant: true,
          quota: topic.questions.length,
          topics: [topic],
        });
      });
      if (sections.some((section) => section.quota > 500))
        throw new Error(
          "В каждом готовом тесте допускается не больше 500 вопросов. Пакет не добавлен.",
        );
      if (bank.sections.length + sections.length > 100)
        throw new Error("В экзамене допускается не больше 100 разделов. Пакет не добавлен.");
      patch({ sections: [...bank.sections, ...sections] });
    });
  const importSource = (sectionIndex: number, source: string) =>
    run(async () => {
      if (!bank) return;
      const [kind, id] = source.split(":");
      if (kind === "test") {
        const test = sources.find((test) => test.id === id);
        if (!test) return;
        addQuestions(sectionIndex, [
          create(BankTopicSchema, { name: test.title, questions: test.questions }),
        ]);
      } else if (kind === "variant") {
        const variant = variants.find((v) => String(v.testId) === id);
        if (!variant) return;
        const draft = await client.previewFetch({ testId: BigInt(id) });
        addQuestions(sectionIndex, [
          create(BankTopicSchema, { name: variant.title, questions: draft.questions }),
        ]);
      }
    });
  const showReport = () =>
    run(async () => {
      const r = await client.reportFetch({
        sessionId: BigInt(sessionID || 0),
        testId: BigInt(reportTestID || 0),
        academicYear: reportTestID ? "" : year,
        season: reportTestID ? "" : season,
      });
      setReport(JSON.parse(r.reportJson) as Report);
    });
  return (
    <CommonWrapper
      title="Экзаменационное тестирование V2"
      description="Создавайте банки вопросов, загружайте тесты и назначайте экзамены."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["create", "Создание и импорт"],
          ["banks", "Банки вопросов"],
          ["variants", "Тесты и расписание"],
          ["reports", "Отчёты и анализ"],
        ].map(([key, title]) => (
          <Button
            key={key}
            variant={
              tab === key || (key === "banks" && tab === "edit-bank") ? "default" : "outline"
            }
            disabled={busy}
            onClick={() => {
              if (key === "create" && bank?.id) {
                if (dirty && !confirm("Отменить несохранённые изменения?")) return;
                setBank(fresh());
                setDirty(true);
              }
              setTab(key);
            }}
          >
            {title}
          </Button>
        ))}
        <Button variant="ghost" disabled={busy} onClick={() => void run(load)}>
          Обновить
        </Button>
        <Button asChild variant="outline">
          <a href={ROUTE.PUBLIC.EXAM_TESTING} target="_blank" rel="noreferrer">
            Общая ссылка класса
          </a>
        </Button>
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-400 p-4 text-red-600">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Обработка…
        </p>
      )}
      {tab === "banks" && (
        <div className="grid gap-4 md:grid-cols-2">
          {banks.map((b) => (
            <button
              className={`rounded border p-3 text-left text-sm ${bank?.id === b.id ? "border-violet-500" : ""}`}
              key={String(b.id)}
              disabled={busy}
              onClick={() => {
                if (dirty && bank?.sections.length && !confirm("Отменить несохранённые изменения?"))
                  return;
                setBank(b);
                setTab("edit-bank");
                setDirty(false);
              }}
            >
              <strong>{b.discipline}</strong>
              <p>
                {b.specialty} · {b.semester} семестр
              </p>
              <p>
                {b.academicYear} · {b.season === "winter" ? "зима" : "лето"}
              </p>
              <p>
                Редактировать · вопросов:{" "}
                {b.sections.reduce((sum, section) => sum + sectionQuestions(section).length, 0)}
              </p>
            </button>
          ))}
          {!banks.length && (
            <p className="text-sm text-muted-foreground">Сохранённых банков пока нет.</p>
          )}
        </div>
      )}
      {(tab === "create" || tab === "edit-bank") && (
        <div className="flex flex-col gap-4">
          {tab === "edit-bank" && (
            <Button
              className="w-fit"
              variant="outline"
              onClick={() => {
                if (dirty && !confirm("Отменить несохранённые изменения?")) return;
                setTab("banks");
              }}
            >
              Назад к банкам
            </Button>
          )}
          <Can section={PermissionSection.EXAM_TESTS}>
            <Button
              className="w-fit"
              disabled={busy}
              onClick={() => {
                if (dirty && bank?.sections.length && !confirm("Отменить несохранённые изменения?"))
                  return;
                setBank(fresh());
                setDirty(true);
                setTab("create");
              }}
            >
              Новый банк
            </Button>
          </Can>
          {bank && (
            <Card className="gap-5 p-5">
              <fieldset className="contents" disabled={busy}>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <h2 className="font-semibold">
                    {bank.id > 0n ? "Редактирование банка" : "Новый банк"}
                  </h2>
                  <p className="mt-1 text-sm">
                    {readyExam
                      ? "Каждый файл сохраняется отдельным готовым тестом."
                      : "Загрузить вопросы → сформировать варианты → назначить студентам."}
                  </p>
                  <p role="status" className="mt-2 text-sm">
                    {blockedGeneration ??
                      (dirty || bank.id === 0n
                        ? "Изменения сохранятся автоматически перед формированием вариантов."
                        : "Банк готов к формированию вариантов.")}
                  </p>
                  <Can section={PermissionSection.EXAM_TESTS}>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        disabled={busy || Boolean(blockedGeneration)}
                        onClick={() => void generate()}
                      >
                        {generationLabel}
                      </Button>
                    </div>
                  </Can>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label>
                    Специальность
                    <input
                      list="exam-specialties"
                      className={field}
                      value={bank.specialty}
                      onChange={(e) => patch({ specialty: e.target.value })}
                    />
                    <datalist id="exam-specialties">
                      {[...new Set([...specialties, ...banks.map((b) => b.specialty)])].map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Факультет
                    <input
                      className={field}
                      value={bank.faculty}
                      onChange={(e) => patch({ faculty: e.target.value })}
                    />
                  </label>
                  <label>
                    Дисциплина
                    <input
                      className={field}
                      value={bank.discipline}
                      onChange={(e) => patch({ discipline: e.target.value })}
                    />
                  </label>
                  <label>
                    Семестр
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className={field}
                      value={bank.semester}
                      onChange={(e) => patch({ semester: number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Учебный год
                    <input
                      className={field}
                      value={bank.academicYear}
                      onChange={(e) => patch({ academicYear: e.target.value })}
                    />
                  </label>
                  <label>
                    Сессия
                    <select
                      className={field}
                      value={bank.season}
                      onChange={(e) => patch({ season: e.target.value })}
                    >
                      <option value="winter">Зимняя</option>
                      <option value="summer">Летняя</option>
                    </select>
                  </label>
                  <label>
                    Время, минут
                    <input
                      type="number"
                      min={1}
                      max={600}
                      className={field}
                      value={bank.durationMinutes}
                      onChange={(e) => patch({ durationMinutes: number(e.target.value) })}
                    />
                  </label>
                  {!readyExam && (
                    <label>
                      Количество вариантов
                      <input
                        type="number"
                        min={1}
                        max={100}
                        className={field}
                        value={bank.variantCount}
                        onChange={(e) => patch({ variantCount: number(e.target.value) })}
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={bank.showResult}
                      onChange={(e) => patch({ showResult: e.target.checked })}
                    />
                    Показать студенту результат
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {(
                    [
                      ["excellent", "Отлично, от %"],
                      ["good", "Хорошо, от %"],
                      ["satisfactory", "Удовлетворительно, от %"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        className={field}
                        type="number"
                        min={1}
                        max={100}
                        value={bank[key]}
                        onChange={(e) => patch({ [key]: number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
                <h2 className="font-semibold">
                  Случайная сборка:{" "}
                  {bank.sections
                    .filter((s) => !s.readyVariant)
                    .reduce((sum, s) => sum + s.quota, 0)}{" "}
                  заданий · готовых тестов: {bank.sections.filter((s) => s.readyVariant).length}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Задайте количество вопросов из каждого раздела для случайной сборки.
                </p>
                {tab === "edit-bank"
                  ? bank.sections.map((section, index) => (
                      <SectionEditor
                        key={index}
                        section={section}
                        index={index}
                        busy={busy}
                        sources={sources}
                        sourcesLoaded={sourcesLoaded}
                        variants={variants}
                        onLoadSources={() => void loadSources()}
                        onChange={(changed) => changeSection(index, changed)}
                        onRemove={() =>
                          patch({ sections: bank.sections.filter((_, i) => i !== index) })
                        }
                        onImport={(files, topicIndex) => void importFiles(index, files, topicIndex)}
                        onSource={(source) => void importSource(index, source)}
                      />
                    ))
                  : bank.sections.map((section, index) => (
                      <div
                        key={index}
                        className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                      >
                        <label className="flex-1">
                          {section.readyVariant ? "Название готового теста" : "Название раздела"}
                          <input
                            className={field}
                            value={section.name}
                            onChange={(e) => changeSection(index, { name: e.target.value })}
                          />
                        </label>
                        <span>{sectionQuestions(section).length} вопросов</span>
                        {!section.readyVariant && (
                          <label>
                            Загрузить вопросы
                            <input
                              type="file"
                              multiple
                              accept=".txt,.docx"
                              disabled={busy}
                              onChange={(e) => {
                                void importFiles(index, Array.from(e.target.files ?? []));
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() =>
                            patch({ sections: bank.sections.filter((_, i) => i !== index) })
                          }
                        >
                          Убрать
                        </Button>
                      </div>
                    ))}

                <Can section={PermissionSection.EXAM_TESTS}>
                  <div className="rounded-xl border border-violet-300 p-4">
                    <h3 className="font-semibold">Готовые тесты из файлов</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Загрузите файлы и сохраните каждый как отдельный готовый тест.
                    </p>
                    <label className="mt-3 block text-sm">
                      Загрузить готовый раздел (.txt / .docx)
                      <input
                        className={field}
                        type="file"
                        multiple
                        accept=".txt,.docx"
                        disabled={busy}
                        onChange={(e) => {
                          void importReadySections(Array.from(e.target.files ?? []));
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </Can>
                <Can section={PermissionSection.EXAM_TESTS}>
                  <div className="grid items-end gap-3 rounded-lg border border-dashed p-4 md:grid-cols-[1fr_180px_auto]">
                    <label className="text-sm">
                      Название нового раздела
                      <input
                        className={field}
                        value={sectionName}
                        onChange={(e) => setSectionName(e.target.value)}
                        placeholder="Например: Кардиология"
                      />
                    </label>
                    <label className="text-sm">
                      Случайных вопросов
                      <input
                        className={field}
                        type="number"
                        min={1}
                        max={500}
                        value={sectionQuota}
                        onChange={(e) => setSectionQuota(e.target.value)}
                      />
                    </label>
                    <Button
                      variant="outline"
                      disabled={
                        busy ||
                        !sectionName.trim() ||
                        number(sectionQuota) < 1 ||
                        number(sectionQuota) > 500 ||
                        !Number.isInteger(number(sectionQuota))
                      }
                      onClick={() => {
                        patch({
                          sections: [
                            ...bank.sections,
                            create(BankSectionSchema, {
                              name: sectionName.trim(),
                              quota: number(sectionQuota),
                            }),
                          ],
                        });
                        setSectionName("");
                      }}
                    >
                      Создать раздел
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => void save()}>
                      {readyExam ? "Сохранить готовые тесты" : "Сохранить банк"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || Boolean(blockedGeneration)}
                      onClick={() => void generate()}
                    >
                      {generationLabel}
                    </Button>
                    {blockedGeneration && (
                      <p role="status" className="text-sm text-muted-foreground">
                        {blockedGeneration}
                      </p>
                    )}
                    {bank.id > 0n && (
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm("Удалить банк? Уже выданные сессии и их результаты сохранятся.")
                          )
                            void run(async () => {
                              await client.bankDelete({ id: bank.id, revision: bank.revision });
                              setBank(undefined);
                              await load();
                            });
                        }}
                      >
                        Удалить банк
                      </Button>
                    )}
                  </div>
                </Can>
              </fieldset>
            </Card>
          )}
        </div>
      )}
      {tab === "variants" && (
        <div className="flex flex-col gap-5">
          <Card className="p-4 text-sm">
            Выберите тест и назначьте его курсу, группе или студентам.
          </Card>
          {!visibleVariants.length && (
            <Card className="gap-3 border-dashed p-5">
              <h2 className="text-lg font-semibold">Тест ещё не сохранён</h2>
              <p className="text-sm text-muted-foreground">
                {readyExam
                  ? "Нажмите «Сохранить готовые тесты»: каждый готовый раздел появится отдельным тестом со своим названием и всеми вопросами."
                  : "Сформируйте тесты из разделов выбранной дисциплины, затем назначьте студентам."}
              </p>
              <p role="status" className="text-sm">
                {blockedGeneration ??
                  "Текущий банк готов: нажмите кнопку ниже, чтобы сохранить его и создать варианты."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setTab(bank?.id ? "edit-bank" : "create")}>
                  {bank ? "Вернуться к текущему банку" : "Выбрать банк"}
                </Button>
                <Can section={PermissionSection.EXAM_TESTS}>
                  {bank && (
                    <Button
                      disabled={busy || Boolean(blockedGeneration)}
                      onClick={() => void generate()}
                    >
                      {generationLabel}
                    </Button>
                  )}
                </Can>
              </div>
            </Card>
          )}
          {visibleVariants.map((v) => (
            <Card
              key={String(v.id)}
              className="flex flex-row flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <h2 className="font-semibold">{v.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {v.durationMinutes} мин · результат{" "}
                  {v.showResult ? "показывается" : "сообщит преподаватель"}
                </p>
              </div>
              <Can section={PermissionSection.EXAM_TESTS}>
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const p = await client.previewFetch({ testId: v.testId });
                        sessionCreate.open({
                          id: String(v.testId),
                          topic: v.title,
                          questionCount: p.questions.length,
                          mixed: false,
                        });
                        sessionCreate.form.setValue("durationMinutes", String(v.durationMinutes));
                        sessionCreate.form.setValue("questionCount", "");
                        sessionCreate.form.setValue("showResult", v.showResult);
                      })
                    }
                  >
                    Назначить / расписание
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const p = await client.previewFetch({ testId: v.testId });
                        setPreview(p.questions);
                        setPicked({});
                        setPreviewDone(false);
                        setPreviewDeadline(Date.now() + v.durationMinutes * 60000);
                      })
                    }
                  >
                    Пробный студент
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Удалить тест «${v.title}» из списка? Выданные сессии и результаты сохранятся. Раздел в банке останется.`,
                        )
                      )
                        void run(async () => {
                          await examTestBuilderApi.remove(String(v.testId));
                          await load();
                          toast.success("Тест удалён");
                        });
                    }}
                  >
                    Удалить тест
                  </Button>
                </div>
              </Can>
            </Card>
          ))}
          <h2 className="text-xl font-semibold">Выданные сессии V2</h2>
          {!visibleSessions.length && (
            <p className="text-sm text-muted-foreground">
              Сессий ещё нет. После формирования варианта нажмите «Назначить / расписание» и
              выберите студентов.
            </p>
          )}
          {visibleSessions.map((s) => (
            <Card key={s.id} className="flex flex-row flex-wrap items-center justify-between p-4">
              <div>
                <Link
                  className="font-semibold underline"
                  to={ROUTE.EXAM_TESTS.SESSION_RESULTS.replace(":id", s.id)}
                >
                  {s.topic}
                </Link>
                <p className="text-sm">
                  Назначено: {s.assignedCount ?? 0} · попыток: {s.attemptCount} ·{" "}
                  {s.opensAt?.toLocaleString() ?? "сразу"} —{" "}
                  {s.closesAt?.toLocaleString() ?? "без даты закрытия"} ·{" "}
                  {s.isOpen ? "приём открыт" : "закрыт"}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSessionID(s.id);
                  setReportTestID("");
                  setTab("reports");
                  void run(async () => {
                    const r = await client.reportFetch({ sessionId: BigInt(s.id) });
                    setReport(JSON.parse(r.reportJson) as Report);
                  });
                }}
              >
                Ведомость / анализ
              </Button>
              <Can section={PermissionSection.EXAM_TESTS}>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        `Удалить сессию «${s.topic}» вместе с назначениями, попытками и результатами? Сам тест останется.`,
                      )
                    )
                      void run(async () => {
                        await examTestSessionApi.remove(s.id);
                        await load();
                        toast.success("Сессия удалена");
                      });
                  }}
                >
                  Удалить сессию
                </Button>
              </Can>
            </Card>
          ))}
        </div>
      )}
      {preview && (
        <Card className="my-5 gap-4 border-violet-400 p-5">
          <h2 className="font-semibold">
            Пробный студент —{" "}
            {previewDone
              ? `верно ${preview.filter((q, i) => q.answers[picked[i]]?.isCorrect).length} из ${preview.length}`
              : `осталось ${Math.ceil(remaining / 60000)} мин`}
          </h2>
          {preview.map((q, i) => (
            <fieldset disabled={previewDone} key={i}>
              <legend>
                {i + 1}. {q.text}
              </legend>
              {q.answers.map((a, ai) => (
                <label key={ai} className="mt-2 flex gap-2">
                  <input
                    type="radio"
                    name={`preview-${i}`}
                    checked={picked[i] === ai}
                    onChange={() => setPicked((p) => ({ ...p, [i]: ai }))}
                  />
                  {a.text}
                  {previewDone && a.isCorrect && " ✓"}
                </label>
              ))}
            </fieldset>
          ))}
          <div className="flex gap-2">
            <Button disabled={previewDone} onClick={() => setPreviewDone(true)}>
              Завершить пробу
            </Button>
            <Button variant="outline" onClick={() => setPreview(undefined)}>
              Закрыть пробного студента
            </Button>
          </div>
        </Card>
      )}
      {tab === "reports" && (
        <div className="flex flex-col gap-5">
          <Card className="gap-3 p-4">
            <label>
              Общая ведомость по тестированию
              <select
                className={field}
                value={reportTestID}
                onChange={(e) => {
                  setReportTestID(e.target.value);
                  setSessionID("");
                  setReport(undefined);
                }}
              >
                <option value="">Выбрать отдельную сессию или сводный отчёт</option>
                {[
                  ...new Map(sessions.filter((s) => s.testId).map((s) => [s.testId!, s])).values(),
                ].map((s) => (
                  <option key={s.testId} value={s.testId}>
                    {s.topic} · все группы и сессии · тест №{s.testId}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-muted-foreground">
              Выберите один тест, чтобы объединить результаты групп из всех его сессий. После
              формирования отчёта можно отметить нужные группы.
            </p>
            {!reportTestID && (
              <label>
                Сессия
                <select
                  className={field}
                  value={sessionID}
                  onChange={(e) => {
                    setSessionID(e.target.value);
                    setReport(undefined);
                  }}
                >
                  <option value="">Сводный отчёт всех сессий V2</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.topic} · {s.createdAt?.toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!sessionID && !reportTestID && (
              <div className="flex gap-3">
                <input
                  className={field}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="Все учебные годы"
                />
                <select
                  className={field}
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                >
                  <option value="">Обе сессии</option>
                  <option value="winter">Зимняя</option>
                  <option value="summer">Летняя</option>
                </select>
              </div>
            )}
            <Button disabled={busy} onClick={() => void showReport()}>
              Сформировать отчёт
            </Button>
          </Card>
          {report && (
            <ReportView
              key={`${reportTestID}:${sessionID}:${report.title}:${report.students.map((s) => `${s.session_id}-${s.id}`).join(",")}`}
              report={report}
            />
          )}
        </div>
      )}
      <TestSessionCreateModal state={sessionCreate} exam examV2 />
    </CommonWrapper>
  );
}
export function MyExamResultsPage() {
  const [rows, setRows] = useState<
      {
        topic: string;
        show_result: boolean;
        score: number | null;
        total: number | null;
        finished_at: string;
      }[]
    >([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    void ownClient
      .resultsFetch({})
      .then((r) => setRows(JSON.parse(r.reportJson)))
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);
  return (
    <CommonWrapper
      title="Мои результаты экзаменов"
      description="Результаты проведённых сессий экзаменационного тестирования V2"
    >
      {loading && <p>Загрузка…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !rows.length && <p>Завершённых экзаменов пока нет.</p>}
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <Card className="p-4" key={i}>
            <h2 className="font-semibold">{r.topic}</h2>
            <p>{r.show_result ? `${r.score} из ${r.total}` : "Результат сообщит преподаватель"}</p>
            <p className="text-sm text-muted-foreground">
              {r.finished_at && new Date(r.finished_at).toLocaleString()}
            </p>
          </Card>
        ))}
      </div>
    </CommonWrapper>
  );
}
