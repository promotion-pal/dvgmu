/* eslint-disable react-hooks/exhaustive-deps -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import { useEffect, useRef, useState } from "react";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { ConnectError, createClient } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { InfoIcon, PencilIcon, QrCodeIcon } from "lucide-react";
import { connectTransport } from "@/shared/config/api";
import { useFetchState } from "@/features/lib/fetch";
import { useCommonModal, type CommonModalConfig } from "@/shared/components/modal";
import type { CommonPopoverProps } from "@/shared/components/menu";
import { ROUTE } from "@/shared/config/path";

import type { Analytic } from "@dvgmu/contract/analytics/entity/analytic.entity_pb";
import type { AnalyticType } from "@dvgmu/contract/analytics/enum/analytic.enum_pb";
import {
  AnalyticService,
  AnalyticFetchRequestSchema,
} from "@dvgmu/contract/analytics/service/analytic.service_pb";
import { SurveyService } from "@dvgmu/contract/fesmu/service/v1/survey.service_pb";
import type { AnalyticSchema} from "./analytic.schema";
import { analyticSchema } from "./analytic.schema";
import { extractAnalyticCategory, isAnalyticTypeEnabled } from "./analytic.utils";
import { AnalyticForm } from "./analytic.form";

/** Чтение опросов и ответов — напрямую из сервиса аналитики (прокси только читает). */
export const analyticClient = createClient(AnalyticService, connectTransport);
/** Заведение и правка опросов, номера QR — модуль «Опросы» в fesmu. */
export const surveyClient = createClient(SurveyService, connectTransport);

export const buildAnalyticDetailPath = (id: bigint) =>
  `${ROUTE.ANALYTICS.SURVEYS}/${id}`;

export type AnalyticCategory = AnalyticType | "all";

// ВРЕМЕННО откатано на старый домен — двгму.рф пока не поднят.
// Новый: `https://xn--b1acb8a9a.xn--p1ai/analytic?qr=${qr}`
export const buildAnalyticQrUrl = (qr: number | bigint) =>
  `${window.location.origin}${ROUTE.PUBLIC.QUESTION}?qr=${qr}`;

const useAnalytic = ({ canEdit = false }: { canEdit?: boolean } = {}) => {
  const listState = useFetchState<Analytic>();
  const singleState = useFetchState<Analytic>();

  const modal = useCommonModal({});
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<AnalyticCategory>("all");

  const [qrTarget, setQrTarget] = useState<bigint | null>(null);
  const openQr = (qr: bigint) => setQrTarget(qr);
  const closeQr = () => setQrTarget(null);


  const fetch = async (
    query: MessageInitShape<typeof AnalyticFetchRequestSchema> = {},
  ) => {
    listState.setLoading(true);
    listState.setError(false);
    try {
      const stream = analyticClient.analyticFetch(
        create(AnalyticFetchRequestSchema, query),
      );

      const collected: Analytic[] = [];
      for await (const chunk of stream) {
        // Пока только включённые виды анкет (см. ENABLED_ANALYTIC_TYPES).
        if (chunk.entity && isAnalyticTypeEnabled(chunk.entity.type)) collected.push(chunk.entity);
      }

      listState.setList(collected);
    } catch (error) {
      console.error("Ошибка при получении списка аналитики:", error);
      listState.setError(true);
    } finally {
      listState.setLoading(false);
    }
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch({
        name: searchQuery || undefined,
        type: selectedType === "all" ? undefined : selectedType,
      });
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, selectedType]);

  const refetchCurrent = () =>
    fetch({
      name: searchQuery || undefined,
      type: selectedType === "all" ? undefined : selectedType,
    });

  const fetchByID = async (id: bigint) => {
    singleState.setActiveId(id);
    singleState.setLoading(true);
    singleState.setError(false);
    try {
      const res = await analyticClient.analyticByID({ id });
      singleState.setItem(res.entity);
      return res.entity;
    } catch (error) {
      console.error("Ошибка при получении данных аналитики:", error);
      singleState.setError(true);
      toast.error("Не удалось загрузить данные аналитики");
    } finally {
      singleState.setLoading(false);
    }
  };

  const form = useAnalyticForm({
    onCloseModal: modal.closeModal,
    refresh: refetchCurrent,
    onCreated: openQr,
  });

  const [editTarget, setEditTarget] = useState<Analytic | undefined>(undefined);
  const editForm = useAnalyticForm({
    onCloseModal: modal.closeModal,
    refresh: refetchCurrent,
    target: editTarget,
  });
  const openEdit = (item: Analytic) => {
    setEditTarget(item);
    modal.openModal("update", item.id);
  };

  const modalConfig: CommonModalConfig = {
    view: {
      title: "Подробнее об объекте аналитики",
      description: "Локация, тип опроса и собранные оценки.",
      component: null,
    },
    create: {
      title: "Новый объект опроса",
      description: "Номер QR можно не вводить — подберётся свободный.",
      component: <AnalyticForm {...form} />,
    },
    update: {
      title: "Редактирование объекта опроса",
      description: "Название, описание, вид опроса и номер QR. Собранные ответы остаются за объектом.",
      component: editTarget ? <AnalyticForm key={editTarget.id.toString()} {...editForm} /> : null,
    },
  };

  const activeMenu = (item: Analytic): CommonPopoverProps["items"] => [
    {
      label: "Подробнее",
      icon: <InfoIcon className="h-3.5 w-3.5" />,
      onClick: () => navigate(buildAnalyticDetailPath(item.id)),
    },
    {
      label: "QR для печати",
      icon: <QrCodeIcon className="h-3.5 w-3.5" />,
      onClick: () => openQr(item.qr),
    },
    ...(canEdit
      ? [
          {
            label: "Редактировать",
            icon: <PencilIcon className="h-3.5 w-3.5" />,
            onClick: () => openEdit(item),
          },
        ]
      : []),
  ];

  return {
    analyticRes: {
      fetch,
      refetch: refetchCurrent,

      searchQuery,
      setSearchQuery,
      selectedType,
      setSelectedType,

      list: listState.list,
      error: listState.error,
      empty: listState.empty,
      loading: listState.loading,

      item: singleState.item,
      activeId: singleState.activeId,
      loadingSingle: singleState.loading,
      errorSingle: singleState.error,
      fetchByID,

    },
    analyticModal: {
      ...modal,
      modalConfig,
    },
    analyticForm: form,
    qrModal: {
      isOpen: qrTarget !== null,
      targetId: qrTarget,
      open: openQr,
      close: closeQr,
    },
    fields: { extractAnalyticCategory },
    activeMenu,
    /** Отсканированный объект: правка, а без права на изменение — его карточка. */
    openScanned: (item: Analytic) => (canEdit ? openEdit(item) : navigate(buildAnalyticDetailPath(item.id))),
  };
};

interface UseAnalyticFormProps {
  refresh: () => void | Promise<void>;
  onCloseModal: () => void;
  onCreated?: (qr: bigint) => void;
  /** Объект для правки; без него форма заводит новый. */
  target?: Analytic;
}

const errorText = (error: unknown, fallback: string) =>
  error instanceof ConnectError ? error.rawMessage : fallback;

/** Форма объекта опроса: заведение (номер QR подбирается сам, если пусто) и
 * правка — через модуль «Опросы» (SurveyService), он же следит, чтобы номер
 * QR не повторялся. */
const useAnalyticForm = ({ refresh, onCloseModal, onCreated, target }: UseAnalyticFormProps) => {
  const form = useForm({
    resolver: zodResolver(analyticSchema),
    defaultValues: target
      ? { name: target.name, transcript: target.transcript, type: target.type, qr: Number(target.qr) }
      : { name: "", transcript: "" },
  });

  // Объект для правки выбирают после создания формы — подставляем его поля.
  useEffect(() => {
    if (target) {
      form.reset({ name: target.name, transcript: target.transcript, type: target.type, qr: Number(target.qr) });
    }
  }, [target, form]);

  // Подсказка по номеру: следующий свободный и занят ли введённый.
  const [nextQr, setNextQr] = useState<bigint>();
  const [takenBy, setTakenBy] = useState("");
  const qrValue = useWatch({ control: form.control, name: "qr" });
  useEffect(() => {
    let cancelled = false;
    const check = Number(qrValue) > 0 ? BigInt(Math.trunc(Number(qrValue))) : 0n;
    const timer = setTimeout(() => {
      surveyClient
        .surveyQrFetch({ check, excludeId: target?.id ?? 0n })
        .then((res) => {
          if (cancelled) return;
          setNextQr(res.next);
          setTakenBy(res.takenBy);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [qrValue, target?.id]);

  const handleSubmit = form.handleSubmit(async (values: AnalyticSchema) => {
    try {
      const qr = values.qr ? BigInt(values.qr) : 0n;
      if (target) {
        await surveyClient.surveyUpdate({
          id: target.id,
          name: values.name,
          transcript: values.transcript ?? "",
          type: values.type as AnalyticType,
          qr: qr || target.qr,
        });
        toast.success("Объект опроса сохранён");
      } else {
        const res = await surveyClient.surveyCreate({
          name: values.name,
          transcript: values.transcript ?? "",
          type: values.type as AnalyticType,
          qr,
        });
        toast.success(`Объект создан, QR ${res.survey?.qr ?? qr}`);
        form.reset();
        onCreated?.(res.survey?.qr ?? qr);
      }
      onCloseModal();
      await refresh();
    } catch (error) {
      console.error("Ошибка сохранения объекта опроса:", error);
      toast.error(errorText(error, "Не удалось сохранить объект"));
    }
  });

  return {
    form,
    handleSubmit,
    mode: target ? ("update" as const) : ("create" as const),
    originalQr: target?.qr,
    nextQr,
    takenBy,
    useNextQr: () => nextQr && form.setValue("qr", Number(nextQr), { shouldValidate: true }),
  };
};

export { useAnalytic, useAnalyticForm };
