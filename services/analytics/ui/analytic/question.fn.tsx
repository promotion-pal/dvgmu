import { zodResolver } from "@hookform/resolvers/zod";
import { AnalyticType } from "@api/enum/analytic.enum_pb";
import { type FieldValues, type Resolver, useForm } from "react-hook-form";
import { useAnalytic } from "@/shared/models/analytic";
import { buildQuestionPages } from "../shared";
import { analyticQuestionGroups } from "./question.groups";
import { emptySchema, mapSchema } from "./question.schema";

interface UseAnalyticQuestionParams {
  id: number;
  type: AnalyticType;
  name?: string;
}

export const useAnalyticQuestion = ({
  id,
  type,
  name,
}: UseAnalyticQuestionParams) => {
  const analytic = useAnalytic({ id });
  const group = analyticQuestionGroups[type];
  const schemaEntry = mapSchema[type];

  const schema = (schemaEntry?.schema ??
    emptySchema) as Parameters<typeof zodResolver>[0];

  const form = useForm<FieldValues>({
    resolver: zodResolver(schema) as Resolver<FieldValues>,
    defaultValues: (schemaEntry?.default ?? {}) as FieldValues,
  });

  const pages = group ? buildQuestionPages(group.fields, form.control) : [];

  return {
    form,
    pages,
    icon: group?.icon,
    isLoading: analytic?.isLoading ?? false,
    title: group?.title ?? "",
    description: name ?? analytic?.name ?? group?.description ?? "",
  };
};

export { useAnalyticQuestion as useQuestionField };
