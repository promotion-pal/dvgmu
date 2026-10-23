# @dvgmu/analytics-ui

UI анкет аналитики. Хранится здесь, подтягивается в приложения через git — это
исходник, а не публикуемый пакет.

Две изолированные зоны:

| Папка | Что | Зависит от |
| --- | --- | --- |
| `shared/` | **универсальные** блоки формы: `CommonQuestion`, `RatingQuestion`, `BooleanQuestion`, `TextareaQuestion`, `QuestionGratitude` + генератор страниц `buildQuestionPages` и типы описаний вопросов | только `react`, `react-hook-form`, `framer-motion`, `lucide-react` |
| `analytic/` | **привязка к analytic-серверу**: `AnalyticType` → набор вопросов (`question.groups`), zod-схемы и дефолты (`question.schema`), хук `useAnalyticQuestion` (`question.fn`) | `shared/` + контракт `@api/*` + `@/shared/models/analytic` |
| `_local/` | заглушки `@api/*` и `@/shared/models/analytic` — только для Storybook / `tsc` внутри папки | — |

`shared/` не импортирует ничего из `analytic/` и `_local/` — его можно копировать в любой проект как есть.

## Разработка

```bash
pnpm install
pnpm storybook        # http://localhost:6007
pnpm typecheck
pnpm build-storybook
```

## Как переиспользовать

### Только универсальные блоки (любой проект)

Скопировать `shared/`. Обеспечить зависимости и токены темы:
`--color-accent`, `--color-accent-bg`, `--color-border`, `--color-text`, `--color-text-h`
(значения по умолчанию — в `.storybook/tailwind.css`).

Собрать анкету из данных:

```tsx
import { CommonQuestion, buildQuestionPages, type QuestionFieldConfig } from "./shared";

const fields: QuestionFieldConfig[] = [
  { kind: "rating", name: "clean", title: "Чистота", description: "…" },
  { kind: "textarea", name: "comment", title: "Комментарий", description: "…" },
];

const pages = buildQuestionPages(fields, form.control);
<CommonQuestion title="…" description="…" icon={<Icon />} pages={pages} onSubmit={…} />
```

### С привязкой к analytic-серверу

Скопировать `shared/` + `analytic/`. Настроить в приложении:

- alias `@api/*` → сгенерированный контракт analytic-сервиса;
- `@/shared/models/analytic` → реальный хук (`AnalyticByID`);
- дальше `useAnalyticQuestion({ id, type })` отдаёт `{ pages, icon, title, description, form, isLoading }`.
