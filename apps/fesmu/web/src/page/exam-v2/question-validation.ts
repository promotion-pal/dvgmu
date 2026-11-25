export type QuestionContent = {
    text: string;
    image?: string;
    answers: ReadonlyArray<{
        text: string;
        isCorrect: boolean;
    }>;
};
export function validateImportedTopic(questions: ReadonlyArray<QuestionContent>, section: string, topic: string) {
    questions.forEach((q, index) => {
        if (q.answers.filter(a => a.isCorrect).length !== 1) {
            throw new Error(`раздел «${section}», тема «${topic}», вопрос №${index + 1}: нужен ровно один правильный ответ. Пакет не добавлен.`);
        }
    });
}
