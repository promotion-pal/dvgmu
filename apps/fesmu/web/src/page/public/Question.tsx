/* eslint-disable @typescript-eslint/no-explicit-any -- схема формы выбирается по виду анкеты (mapSchema); перенесено из старого dvgmu как есть */
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardListIcon } from "lucide-react";
import { create } from "@bufbuild/protobuf";

import { AnalyticType } from "@dvgmu/contract/analytics/enum/analytic.enum_pb";
import { AnalyticSchema } from "@dvgmu/contract/analytics/entity/analytic.entity_pb";
import type { Analytic } from "@dvgmu/contract/analytics/entity/analytic.entity_pb";
import { isAnalyticTypeEnabled } from "@/widgets/analytic";
import {
  analyticQuestionGroups,
  buildQuestionPages,
  CommonQuestion,
  mapSchema,
  questionPageFieldNames,
  QuestionGratitude,
  toRatingPayload,
  useQuestionnaire,
} from "@/widgets/question";
import type { QuestionLookup, QuestionPayload } from "@/widgets/question";
import { CommonControlState } from "@/shared/components/state";

export default function QuestionPage() {
  const [searchParams] = useSearchParams();

  const rawQr = searchParams.get("qr");
  const rawId = searchParams.get("id");

  const qr = Number(rawQr);
  const id = Number(rawId);

  // Печатный QR ведёт на ?qr=<номер>; ?id=<pk> оставлен для обратной совместимости.
  if (rawQr && !Number.isNaN(qr)) {
    return <QuestionLive lookup={{ by: "qr", value: BigInt(qr) }} />;
  }
  if (rawId && !Number.isNaN(id)) {
    return <QuestionLive lookup={{ by: "id", value: BigInt(id) }} />;
  }

  return <QuestionPreview preview={searchParams.get("preview")} />;
}

function QuestionLive({ lookup }: { lookup: QuestionLookup }) {
  const questionnaire = useQuestionnaire();

  useEffect(() => {
    questionnaire.fetch(lookup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup.by, lookup.value]);

  const analytic = questionnaire.analytic;
  // Включённые в fesmu виды анкет (туалеты, залы и тех. снабжение — позже).
  const supported = Boolean(analytic && mapSchema[analytic.type] && isAnalyticTypeEnabled(analytic.type));

  if (questionnaire.submitted) return <GratitudeScreen />;

  if (!analytic || !supported) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <CommonControlState
          isLoading={questionnaire.loading}
          isError={questionnaire.error || (!questionnaire.loading && !supported)}
          isEmpty={false}
          styleWrapper="w-full"
          error={
            <p className="text-center text-sm text-muted-foreground">
              Опросник не найден или недоступен. Проверьте QR-код.
            </p>
          }
        />
      </main>
    );
  }

  return (
    <QuestionSurvey
      analytic={analytic}
      submitting={questionnaire.submitting}
      errored={questionnaire.submitError !== null}
      errorMessage={questionnaire.submitError}
      submit={questionnaire.submit}
    />
  );
}

function QuestionPreview({ preview }: { preview: string | null }) {
  const [submitted, setSubmitted] = useState(false);

  // Превью: ?preview=security | toilet | lecture, иначе — рабочее место.
  const type =
    preview === "security"
      ? AnalyticType.INFORMATION_SECURITY
      : preview === "toilet"
        ? AnalyticType.TOILET
        : preview === "lecture"
          ? AnalyticType.LECTURE
          : AnalyticType.WORKPLACE;

  const analytic = create(AnalyticSchema, {
    id: 0n,
    qr: 0n,
    name: "Демонстрационный опросник",
    transcript: "Превью",
    type,
    ratings: [],
  });

  if (submitted) return <GratitudeScreen />;

  return (
    <QuestionSurvey
      analytic={analytic}
      submitting={false}
      errored={false}
      submit={async () => setSubmitted(true)}
    />
  );
}

function GratitudeScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <QuestionGratitude />
    </main>
  );
}

interface QuestionSurveyProps {
  analytic: Analytic;
  submitting: boolean;
  errored: boolean;
  errorMessage?: string | null;
  submit: (payload: QuestionPayload) => void | Promise<unknown>;
}

function QuestionSurvey({ analytic, submitting, errored, errorMessage, submit }: QuestionSurveyProps) {
  const group = analyticQuestionGroups[analytic.type];
  const schemaEntry = mapSchema[analytic.type]!;

  const form = useForm<Record<string, any>>({
    resolver: zodResolver(schemaEntry.schema as any),
    defaultValues: schemaEntry.default as Record<string, any>,
    mode: "onChange",
  });

  const handleFormSubmit = form.handleSubmit(async (data) => {
    await submit({
      analyticId: analytic.id,
      ...toRatingPayload(analytic.type, data),
    });
  });

  // Некоторые вопросы видны только при определённых ответах (см.
  // `visibleWhen` у ПДн-вопросов анкеты ИБ) — form.watch() переоценивает это
  // на каждый рендер, так что страница исчезает из мастера сразу же, как
  // респондент меняет ответ на вопрос-триггер.
  const values = form.watch();
  const visibleFields =
    group?.fields.filter((f) => !f.visibleWhen || f.visibleWhen(values)) ?? [];

  if (!group) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <p className="text-center text-sm text-muted-foreground">
          Для этого типа аналитики опросник ещё не настроен.
        </p>
      </main>
    );
  }

  const pages = buildQuestionPages(visibleFields, form.control);
  const pageFieldNames = questionPageFieldNames(visibleFields);

  const validatePage = async (pageIndex: number) => {
    const names = pageFieldNames[pageIndex] ?? [];
    if (names.length === 0) return true;
    return form.trigger(names as never);
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16">
      <FormProvider {...form}>
        <form onSubmit={handleFormSubmit}>
          <CommonQuestion
            id={analytic.qr ? Number(analytic.qr) : undefined}
            icon={group.icon ?? <ClipboardListIcon className="h-10 w-10 text-accent" />}
            title={group.title}
            description={analytic.name || group.description}
            pages={pages}
            isLoading={submitting}
            error={
              errored
                ? errorMessage || "Не удалось отправить ответы"
                : null
            }
            onValidatePage={validatePage}
            onSubmit={handleFormSubmit}
          />
        </form>
      </FormProvider>
    </main>
  );
}
