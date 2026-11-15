import type { ReactNode } from "react";
import { RefreshCwIcon, ServerCrashIcon, TriangleAlertIcon } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty";
import { Button } from "@/shared/ui/button";

interface CommonErrorProps {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
}

export function CommonError({
  title = "Что-то пошло не так",
  description = "Не удалось загрузить данные. Попробуйте обновить страницу.",
  onRetry,
}: CommonErrorProps = {}) {
  return (
    <Empty className="border border-dashed rounded-xl">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <TriangleAlertIcon />
        </EmptyMedia>

        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>

      {onRetry && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon className="size-3.5" />
            Повторить
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

interface CommonServiceErrorProps {
  service?: string;
  hint?: ReactNode;
  onRetry?: () => void;
}

export function CommonServiceError({
  service,
  hint,
  onRetry,
}: CommonServiceErrorProps = {}) {
  return (
    <Empty className="border border-dashed rounded-xl border-amber-500/30 bg-amber-500/5">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="bg-amber-500/15 text-amber-600 dark:text-amber-400"
        >
          <ServerCrashIcon />
        </EmptyMedia>

        <EmptyTitle>Сервис недоступен</EmptyTitle>

        <EmptyDescription>
          Не удалось подключиться к сервису
          {service ? ` ${service}` : ""}. Возможно, он перезапускается или
          временно не отвечает — попробуйте позже.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        {hint && (
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            {hint}
          </p>
        )}

        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon className="size-3.5" />
            Повторить подключение
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );
}
