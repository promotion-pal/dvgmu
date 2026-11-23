export type QuestionContent = {
    text: string;
    image?: string;
    answers: ReadonlyArray<{
        text: string;
        isCorrect: boolean;
    }>;
};
type TopicContent = {
    name: string;
    questions: ReadonlyArray<QuestionContent>;
};
type SectionContent = {
    name: string;
    topics: ReadonlyArray<TopicContent>;
    questions?: ReadonlyArray<QuestionContent>;
};
type Occurrence = {
    location: string;
    answerKey: string;
};
export type QuestionRegistry = Map<string, Occurrence>;
const normalized = (s: string) => s.toLocaleLowerCase("ru").trim().replace(/\s+/gu, " ");
// Preserve symbols and image identity; choices may be reordered without changing a task.
export const questionIdentity = (q: QuestionContent) => JSON.stringify([normalized(q.text), q.image ?? "", q.answers.map(a => normalized(a.text)).sort()]);
const answerKey = (q: QuestionContent) => JSON.stringify(q.answers.map(a => [normalized(a.text), a.isCorrect] as const).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : Number(a[1]) - Number(b[1])));
export const questionLocation = (section: string, topic: string, index: number) => `раздел «${section}», тема «${topic}», вопрос №${index + 1}`;
export function registerQuestion(seen: QuestionRegistry, q: QuestionContent, location: string) {
    const key = questionIdentity(q), correct = answerKey(q), previous = seen.get(key);
    if (previous) {
        const title = Array.from(q.text).slice(0, 160).join("") + (Array.from(q.text).length > 160 ? "…" : "");
        const conflict = previous.answerKey === correct ? "" : " Разметка правильного ответа отличается — проверьте оба задания.";
        throw new Error(`Повтор задания «${title}»: ${location}; совпадает с ${previous.location}.${conflict} Пакет не добавлен.`);
    }
    seen.set(key, { location, answerKey: correct });
}
export function existingQuestions(sections: ReadonlyArray<SectionContent>): QuestionRegistry {
    const seen: QuestionRegistry = new Map();
    for (const section of sections) {
        section.questions?.forEach((q, i) => registerQuestion(seen, q, questionLocation(section.name, "Ранее загруженные вопросы", i)));
        for (const topic of section.topics)
            topic.questions.forEach((q, i) => registerQuestion(seen, q, questionLocation(section.name, topic.name, i)));
    }
    return seen;
}
export function registerImportedTopic(seen: QuestionRegistry, questions: ReadonlyArray<QuestionContent>, section: string, topic: string) {
    questions.forEach((q, index) => {
        const location = questionLocation(section, topic, index);
        if (q.answers.filter(a => a.isCorrect).length !== 1)
            throw new Error(`${location}: нужен ровно один правильный ответ. Пакет не добавлен.`);
        registerQuestion(seen, q, location);
    });
}
