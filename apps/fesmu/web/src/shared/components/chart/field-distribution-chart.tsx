/* eslint-disable @typescript-eslint/no-explicit-any -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import type { FC } from "react";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import { cn } from "@/shared/lib/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/ui/chart";

export interface FieldDistributionBucket {
  label: string;
  count: number;
  /** 0–100 */
  percent: number;
}

const truncateLabel = (label: string, max = 26): string =>
  label.length > max ? `${label.slice(0, max - 1)}…` : label;

interface FieldDistributionChartProps {
  buckets: FieldDistributionBucket[];
  emptyLabel?: string;
  className?: string;
}

/**
 * Горизонтальная столбчатая диаграмма распределения ответов по одному полю
 * опроса — общий для rating/bool/enum/enumList, всё сводится к
 * {label, count, percent}. Общий компонент для models_v2/analytic и
 * models_v2/analytic-report, чтобы не плодить копии графика.
 */
export const FieldDistributionChart: FC<FieldDistributionChartProps> = ({
  buckets,
  emptyLabel = "Нет заполненных ответов",
  className,
}) => {
  if (!buckets.length) {
    return (
      <div
        className={cn(
          "flex h-[140px] flex-col items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  // Высота растёт вместе с числом строк, а не остаётся фиксированной — иначе
  // при 1–2 бакетах столбец растягивается на всю карточку.
  const height = Math.min(280, Math.max(120, buckets.length * 44 + 32));

  return (
    <ChartContainer
      config={{}}
      className={cn("w-full", className)}
      style={{ height }}
    >
      <BarChart
        accessibilityLayer
        data={buckets}
        layout="vertical"
        margin={{ left: 0, right: 44 }}
        barSize={24}
      >
        <YAxis
          width={150}
          dataKey="label"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => truncateLabel(String(value))}
        />
        <XAxis dataKey="percent" type="number" hide domain={[0, 100]} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(_value, _name, item) => (
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {item.payload.count} · {item.payload.percent}%
                </span>
              )}
            />
          }
        />
        <Bar dataKey="percent" radius={5} fill="var(--primary)">
          <LabelList
            dataKey="percent"
            position="right"
            offset={10}
            className="fill-foreground"
            fontSize={12}
            fontWeight={600}
            formatter={(value: any) => `${value}%`}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
};
