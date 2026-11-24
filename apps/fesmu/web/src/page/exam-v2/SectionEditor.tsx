import { useState } from "react";
import { create } from "@bufbuild/protobuf";
import { BankTopicSchema } from "@fesmu/contract/fesmu/exam/service/v2/exam_bank.service_pb";
import type { BankSection, BankTopic, GeneratedVariant } from "@fesmu/contract/fesmu/exam/service/v2/exam_bank.service_pb";
import { TestQuestionInputSchema, TestAnswerInputSchema } from "@fesmu/contract/fesmu/service/v1/test.service_pb";
import type { TestQuestionInput } from "@fesmu/contract/fesmu/service/v1/test.service_pb";
import { Button } from "@/shared/ui/button";
import { Can } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
const field = "w-full rounded-md border bg-background p-2 text-sm";
export const sectionQuestions = (section: BankSection) => [...section.questions, ...section.topics.flatMap(topic => topic.questions)];
export type SourceTest = {
    id: string;
    title: string;
    questions: TestQuestionInput[];
};
function QuestionEditor({ question, onChange, onRemove, name }: {
    question: TestQuestionInput;
    onChange: (q: TestQuestionInput) => void;
    onRemove: () => void;
    name: string;
}) {
    return <div className="rounded border bg-background p-3">
  <textarea aria-label="Текст вопроса" className={field} rows={2} value={question.text} onChange={e => onChange({ ...question, text: e.target.value })}/>
  {question.answers.map((answer, index) => <div className="mt-2 flex items-center gap-2" key={index}>
   <input aria-label={`Правильный ответ ${index + 1}`} type="radio" name={name} checked={answer.isCorrect} onChange={() => onChange({ ...question, answers: question.answers.map((old, i) => ({ ...old, isCorrect: i === index })) })}/>
   <input aria-label={`Вариант ответа ${index + 1}`} className={field} value={answer.text} onChange={e => onChange({ ...question, answers: question.answers.map((old, i) => i === index ? { ...old, text: e.target.value } : old) })}/>
   <Button variant="ghost" disabled={question.answers.length <= 2} onClick={() => onChange({ ...question, answers: question.answers.filter((_, i) => i !== index) })}>×</Button>
  </div>)}
  <Can section={PermissionSection.EXAM_TESTS}><div className="mt-2 flex gap-2">
   <Button variant="ghost" disabled={question.answers.length >= 30} onClick={() => onChange({ ...question, answers: [...question.answers, create(TestAnswerInputSchema)] })}>Добавить ответ</Button>
   <Button variant="ghost" onClick={onRemove}>Удалить вопрос</Button>
  </div></Can>
 </div>;
}
function TopicEditor({ topic, onChange, onRemove, onImport, busy, prefix }: {
    topic: BankTopic;
    onChange: (topic: BankTopic) => void;
    onRemove: () => void;
    onImport: (files: File[]) => void;
    busy: boolean;
    prefix: string;
}) {
    const [limit, setLimit] = useState(20);
    return <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
  <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">Источник вопросов / имя файла<input className={field} value={topic.name} onChange={e => onChange({ ...topic, name: e.target.value })}/></label><span className="text-sm">{topic.questions.length} вопросов</span><Can section={PermissionSection.EXAM_TESTS}><Button variant="ghost" disabled={busy} onClick={onRemove}>Удалить тему</Button></Can></div>
  <Can section={PermissionSection.EXAM_TESTS}><div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Добавить вопросы в эту тему<input className={field} type="file" multiple accept=".txt,.docx" disabled={busy} onChange={e => { onImport(Array.from(e.target.files ?? [])); e.target.value = ""; }}/></label><Button className="self-end" variant="outline" disabled={busy} onClick={() => onChange({ ...topic, questions: [...topic.questions, create(TestQuestionInputSchema, { answers: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] })] })}>Добавить вопрос вручную</Button></div></Can>
  <details><summary className="cursor-pointer text-sm">Посмотреть и редактировать вопросы ({topic.questions.length})</summary><div className="mt-3 flex max-h-[560px] flex-col gap-4 overflow-auto">
   {topic.questions.slice(0, limit).map((q, index) => <QuestionEditor key={index} name={`${prefix}-${index}`} question={q} onChange={changed => onChange({ ...topic, questions: topic.questions.map((old, i) => i === index ? changed : old) })} onRemove={() => onChange({ ...topic, questions: topic.questions.filter((_, i) => i !== index) })}/>)}
   {topic.questions.length > limit && <Button variant="outline" onClick={() => setLimit(n => n + 20)}>Показать ещё ({topic.questions.length - limit})</Button>}
  </div></details>
 </div>;
}
type Props = {
    section: BankSection;
    index: number;
    busy: boolean;
    onChange: (section: BankSection) => void;
    onRemove: () => void;
    onImport: (files: File[], topicIndex?: number) => void;
    onSource: (source: string) => void;
    sources: SourceTest[];
    sourcesLoaded: boolean;
    onLoadSources: () => void;
    variants: GeneratedVariant[];
};
export function SectionEditor({ section, index, busy, onChange, onRemove, onImport, onSource, sources, sourcesLoaded, onLoadSources, variants }: Props) {
    const [topicName, setTopicName] = useState("");
    const available = sectionQuestions(section).length;
    return <section className="flex flex-col gap-4 rounded-xl border p-4">
  <div className="grid items-end gap-3 md:grid-cols-[1fr_180px_auto]">
   <label className="text-sm font-medium">{section.readyVariant ? "Название готового теста" : "Название раздела"}<input className={field} value={section.name} onChange={e => onChange({ ...section, name: e.target.value })}/></label>
   <label className="text-sm font-medium">{section.readyVariant ? "Включаются все вопросы" : "Случайных вопросов в варианте"}<input className={field} type="number" min={0} max={500} readOnly={section.readyVariant} value={section.readyVariant ? available : section.quota} onChange={e => onChange({ ...section, quota: Number(e.target.value) || 0 })}/></label>
   <Can section={PermissionSection.EXAM_TESTS}><Button variant="ghost" disabled={busy} onClick={onRemove}>{section.readyVariant ? "Убрать из банка" : "Удалить раздел"}</Button></Can>
  </div>
  {section.readyVariant ? <p className="rounded-lg border border-violet-300 bg-violet-50 p-3 text-sm text-violet-950"><strong>Отдельный готовый тест.</strong> Все {available} вопросов сохраняются одним тестом.</p> : <p className="text-sm">Тем: <strong>{section.topics.length}</strong> · В банке: <strong>{available}</strong> · В вариант попадёт: <strong>{section.quota}</strong>. Вопросы выбираются случайно из всех тем этого раздела.</p>}
  {section.quota > available && <p role="status" className="text-sm text-amber-700">Для квоты {section.quota} добавьте ещё {section.quota - available} вопросов в темы раздела.</p>}
  {!section.readyVariant && <>
  <Can section={PermissionSection.EXAM_TESTS}>
   <div className="grid gap-3 rounded-lg border border-dashed p-3 md:grid-cols-2">
    <label className="text-sm">Импортировать темы из файлов<input className={field} type="file" multiple accept=".txt,.docx" disabled={busy} onChange={e => { onImport(Array.from(e.target.files ?? [])); e.target.value = ""; }}/><span className="text-xs text-muted-foreground">Каждый файл станет отдельной темой со своими вопросами.</span></label>
    <div className="flex flex-col justify-end gap-2"><label className="text-sm">Новая тема<input className={field} value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="Например: Нарушения ритма"/></label><Button variant="outline" disabled={busy || !topicName.trim()} onClick={() => { onChange({ ...section, topics: [...section.topics, create(BankTopicSchema, { name: topicName.trim() })] }); setTopicName(""); }}>Создать тему</Button></div>
    <div className="flex flex-col gap-2 md:col-span-2"><label className="text-sm">Добавить сохранённый тест как тему<select aria-label="Источник вопросов" className={field} value="" disabled={busy} onChange={e => {
                if (e.target.value)
                    onSource(e.target.value);
            }}><option value="">Выберите тест или готовый вариант</option>{!!sources.length && <optgroup label="Сохранённые тесты">{sources.map(test => <option key={test.id} value={`test:${test.id}`}>{test.title}</option>)}</optgroup>}{!!variants.length && <optgroup label="Готовые варианты экзаменов">{variants.map(v => <option key={String(v.id)} value={`variant:${v.testId}`}>{v.title}</option>)}</optgroup>}</select></label>{!sourcesLoaded && <Button variant="outline" disabled={busy} onClick={onLoadSources}>Загрузить список сохранённых тестов</Button>}</div>
   </div>
  </Can>
  </>}
  {section.topics.map((topic, topicIndex) => <TopicEditor key={topicIndex} prefix={`section-${index}-topic-${topicIndex}`} topic={topic} busy={busy} onChange={changed => onChange({ ...section, topics: section.topics.map((old, i) => i === topicIndex ? changed : old) })} onRemove={() => onChange({ ...section, topics: section.topics.filter((_, i) => i !== topicIndex) })} onImport={files => onImport(files, topicIndex)}/>)}
  {!section.topics.length && <p className="text-sm text-muted-foreground">Добавьте тему, загрузите файлы или выберите сохранённый тест, чтобы наполнить раздел.</p>}
 </section>;
}
