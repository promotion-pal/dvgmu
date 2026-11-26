import type { JsonObject, MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import type { Service } from "@fesmu/contract/tasks/entity/service_pb";
import { FormFieldType, type FormField } from "@fesmu/contract/tasks/entity/service_form_pb";
import type { CreateTaskRequestSchema } from "@fesmu/contract/tasks/service/task_service_pb";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { signIn } from "@/shared/config/session";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { getTaskServiceForm, taskClient } from "./api";
import { TaskRequestField } from "./task-request-fields";

type Submission = MessageInitShape<typeof CreateTaskRequestSchema>;
type FieldError = { fieldName: string; message: string };
type SubmissionState =
  | { status: "idle" | "sending" | "stale" | "signedOut" }
  | { status: "error"; message: string; fieldName?: string }
  | { status: "retry"; message: string; input: Submission }
  | { status: "success"; number: string };
type ServiceForm = Awaited<ReturnType<typeof getTaskServiceForm>>;
type FormState =
  | { status: "loading" | "error"; current?: ServiceForm }
  | { status: "ready"; current: ServiceForm };

export function TaskRequestDialog({ service }: { service: Service }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`Подать заявку на услугу «${service.name}»`}>
          Подать заявку
        </Button>
      </DialogTrigger>
      {open && <TaskRequestPanel service={service} />}
    </Dialog>
  );
}

function TaskRequestPanel({ service }: { service: Service }) {
  const serviceId = service.id;
  const [form, setForm] = useState<FormState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [submission, setSubmission] = useState<SubmissionState>({ status: "idle" });
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const titleErrorId = useId();
  const fieldError = submission.status === "error" && submission.fieldName ? submission : undefined;

  useEffect(() => {
    const controller = new AbortController();
    getTaskServiceForm(serviceId, controller.signal).then(
      (current) => {
        if (controller.signal.aborted) return;
        setForm({ status: "ready", current });
        setSubmission({ status: "idle" });
      },
      () => {
        if (!controller.signal.aborted) {
          setForm((previous) => ({ status: "error", current: previous.current }));
        }
      },
    );
    return () => controller.abort();
  }, [serviceId, loadAttempt]);

  useEffect(() => {
    if (fieldError?.fieldName) {
      formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(fieldError.fieldName)}"]`)?.focus();
    }
  }, [fieldError]);

  const fields = form.current?.schema?.fields ?? [];
  const sending = submission.status === "sending";
  const requiredAttachment = fields.some(
    (field) => field.required && field.type === FormFieldType.ATTACHMENT,
  );
  const canSubmit =
    form.status === "ready" &&
    !requiredAttachment &&
    (submission.status === "idle" || submission.status === "error");

  function reloadForm() {
    setForm((previous) => ({ status: "loading", current: previous.current }));
    setLoadAttempt((previous) => previous + 1);
  }

  async function send(input: Submission) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmission({ status: "sending" });
    // Apply the timeout locally so the portal call needs no Connect-Timeout-Ms header.
    const signal = AbortSignal.timeout(5000);
    try {
      const { task } = await taskClient.createTask(input, { signal });
      setSubmission(task?.number
        ? { status: "success", number: task.number }
        : { status: "retry", input, message: "Не удалось получить номер заявки. Повторите отправку." });
    } catch (error) {
      setSubmission(rejectedSubmission(error, input, fields, signal.aborted));
    } finally {
      inFlight.current = false;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || form.status !== "ready" || inFlight.current) return;

    const element = event.currentTarget;
    const data = new FormData(element);
    const title = String(data.get("title") ?? "").trim();
    if (!title || title.includes("\0") || Array.from(title).length > 150) {
      setSubmission({
        status: "error",
        fieldName: "title",
        message: "Укажите заголовок от 1 до 150 символов.",
      });
      return;
    }

    const extra = readExtraFields(element, data, fields);
    if ("fieldName" in extra) {
      setSubmission({ status: "error", ...extra });
      return;
    }

    void send({
      serviceId,
      title,
      description: String(data.get("description") ?? "").trim(),
      formVersion: form.current.version,
      extraFields: extra.values,
      idempotencyKey: crypto.randomUUID(),
    });
  }

  return (
    <DialogContent
      showCloseButton={false}
      onInteractOutside={(event) => event.preventDefault()}
      onEscapeKeyDown={(event) => {
        if (inFlight.current) event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-lg">
          {submission.status === "success" ? "Заявка создана" : "Новая заявка"}
        </DialogTitle>
        <DialogDescription className="wrap-anywhere">{service.name}</DialogDescription>
      </DialogHeader>

      {submission.status === "success" ? (
        <>
          <p role="status">Номер заявки <strong>{submission.number}</strong></p>
          <DialogFooter>
            <DialogClose asChild><Button>Готово</Button></DialogClose>
          </DialogFooter>
        </>
      ) : (
        <form
          ref={formRef}
          className="grid gap-4"
          noValidate
          onSubmit={submit}
          onChange={(event) => {
            const target = event.target;
            if (target instanceof HTMLElement && fieldError && target.getAttribute("name") === fieldError.fieldName) {
              setSubmission({ status: "idle" });
            }
          }}
        >
          {form.current && (
            <fieldset disabled={!canSubmit} className="grid min-w-0 gap-4">
              <div className="grid gap-1.5">
                <label className="grid gap-1.5 font-medium">
                  Заголовок *
                  <Input
                    name="title"
                    required
                    aria-invalid={fieldError?.fieldName === "title" || undefined}
                    aria-describedby={fieldError?.fieldName === "title" ? titleErrorId : undefined}
                  />
                </label>
                {fieldError?.fieldName === "title" && (
                  <p id={titleErrorId} role="alert" className="text-sm text-destructive">{fieldError.message}</p>
                )}
              </div>
              <label className="grid gap-1.5 font-medium">
                Описание
                <Textarea name="description" rows={3} />
              </label>
              <div key={String(form.current.version)} className="contents">
                {fields.map((field) => {
                  const name = fieldName(field);
                  return (
                    <TaskRequestField
                      key={field.code}
                      field={field}
                      name={name}
                      error={fieldError?.fieldName === name ? fieldError.message : undefined}
                    />
                  );
                })}
              </div>
            </fieldset>
          )}

          {requiredAttachment && (
            <p role="alert" className="text-destructive">
              Для этой услуги требуется вложение. Подать заявку пока нельзя.
            </p>
          )}
          {form.status === "loading" && <p role="status">Загружаем форму…</p>}
          {form.status === "error" && (
            <p role="alert" className="text-destructive">Не удалось загрузить форму услуги.</p>
          )}
          {submission.status === "stale" && (
            <p role="alert">
              Форма услуги изменилась. После обновления заполните дополнительные поля заново.
              Заголовок и описание сохранятся.
            </p>
          )}
          {submission.status === "signedOut" && (
            <p role="alert" className="text-destructive">Сессия истекла. Войдите в портал снова.</p>
          )}
          {((submission.status === "error" && !fieldError) || submission.status === "retry") && (
            <p role="alert" className="text-destructive">{submission.message}</p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={sending}>Закрыть</Button>
            </DialogClose>
            {(form.status === "error" || (form.status === "ready" && submission.status === "stale")) && (
              <Button type="button" onClick={reloadForm}>Обновить форму</Button>
            )}
            {submission.status === "retry" && (
              <Button type="button" onClick={() => void send(submission.input)}>
                Повторить отправку
              </Button>
            )}
            {submission.status === "signedOut" && (
              <Button type="button" onClick={() => signIn()}>Войти</Button>
            )}
            {((form.status === "ready" && (submission.status === "idle" || submission.status === "error")) ||
              sending) && (
              <Button type="submit" disabled={!canSubmit}>
                {sending ? "Отправляем…" : "Отправить заявку"}
              </Button>
            )}
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}

function fieldName(field: FormField) {
  return `field-${field.code}`;
}

function readExtraFields(form: HTMLFormElement, data: FormData, fields: FormField[]): { values: JsonObject } | FieldError {
  const extra: JsonObject = {};
  for (const field of fields) {
    if (field.type === FormFieldType.ATTACHMENT) continue;

    const name = fieldName(field);
    const error = (message: string): FieldError => ({ fieldName: name, message });
    const control = form.elements.namedItem(name);
    if (control instanceof HTMLInputElement && control.validity.badInput) {
      return error(field.type === FormFieldType.NUMBER ? "Введите число." : "Укажите корректную дату.");
    }
    const values = data.getAll(name).map(String).filter(Boolean);
    if (values.length === 0) {
      if (field.required) {
        return error(field.type === FormFieldType.MULTIPLE_CHOICE
          ? "Выберите хотя бы один вариант."
          : "Заполните это поле.");
      }
      continue;
    }

    const [value] = values;
    switch (field.type) {
      case FormFieldType.MULTIPLE_CHOICE:
        extra[field.code] = values;
        break;
      case FormFieldType.BOOLEAN:
        extra[field.code] = value === "true";
        break;
      case FormFieldType.NUMBER: {
        const number = Number(value);
        if (!Number.isFinite(number)) return error("Введите число.");
        if (field.settings.case === "number") {
          const { min, max } = field.settings.value;
          if (min !== undefined && number < min) return error(`Введите число не меньше ${min}.`);
          if (max !== undefined && number > max) return error(`Введите число не больше ${max}.`);
        }
        extra[field.code] = number;
        break;
      }
      case FormFieldType.DATE:
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return error("Укажите дату в формате ГГГГ-ММ-ДД.");
        }
        extra[field.code] = value;
        break;
      case FormFieldType.SHORT_TEXT:
      case FormFieldType.LONG_TEXT:
        if (field.required && !value.trim()) return error("Заполните это поле.");
        if (field.settings.case === "text" && Array.from(value).length > field.settings.value.maxLength) {
          return error(`Сократите текст до ${field.settings.value.maxLength} симв.`);
        }
        extra[field.code] = value;
        break;
      case FormFieldType.SINGLE_CHOICE:
        extra[field.code] = value;
        break;
    }
  }
  return { values: extra };
}

function rejectedSubmission(
  error: unknown,
  input: Submission,
  fields: FormField[],
  timedOut: boolean,
): SubmissionState {
  const { code, rawMessage } = ConnectError.from(error);
  switch (timedOut ? Code.DeadlineExceeded : code) {
    case Code.Unauthenticated:
      return { status: "signedOut" };
    case Code.PermissionDenied:
      return { status: "error", message: "Для подачи заявки нужен активный профиль в MDM." };
    case Code.InvalidArgument: {
      const fieldCode = /\bfield "([a-z0-9_-]+)"/.exec(rawMessage)?.[1];
      const field = fields.find(({ code }) => code === fieldCode);
      if (field && field.type !== FormFieldType.ATTACHMENT) {
        return { status: "error", fieldName: fieldName(field), message: "Проверьте значение поля." };
      }
      return { status: "error", message: "Проверьте заголовок, описание и поля заявки." };
    }
    case Code.Aborted:
      return { status: "stale" };
    case Code.AlreadyExists:
      return {
        status: "error",
        message: "Ключ отправки уже использован для другой заявки. Проверьте данные и отправьте заявку снова.",
      };
    case Code.FailedPrecondition:
      return {
        status: "error",
        message: "Услуга или направление отключены либо для услуги требуется настроить начальный статус и приоритет.",
      };
    case Code.NotFound:
      return { status: "error", message: "Услуга больше недоступна." };
    case Code.Unavailable:
      return {
        status: "retry",
        input,
        message: "Сервис временно недоступен. Попробуйте повторить отправку.",
      };
    case Code.DeadlineExceeded:
      return {
        status: "retry",
        input,
        message: "Ответ не пришёл вовремя. Повторите отправку, чтобы получить номер заявки.",
      };
    default:
      return {
        status: "retry",
        input,
        message: "Не удалось подтвердить создание заявки. Попробуйте повторить отправку.",
      };
  }
}
