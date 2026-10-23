/* eslint-disable @typescript-eslint/no-explicit-any -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import { groupAndCount, recordToChartRows } from "@/widgets/analytic/analytic.lib";
import { cn } from "@/shared/lib/utils";
import { CommonInfo } from "@/shared/components/info";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import type { ChartConfig} from "@/shared/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/ui/chart";
import type { ReactNode} from "react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { useAnalyticContext } from "./analytic.model";

interface ChartCommonBarProps {
    title: string;
    config: ChartConfig;
    description: string;
    styleWrapper?: string;
    data: Array<Record<string, any>>;
}
const CharCommontBar: React.FC<ChartCommonBarProps> = ({
    data,
    title,
    config,
    description,
    styleWrapper,
}) => {
    const typeArr = useMemo(() => Object.keys(config), [config]);

    const [activeChart, setActiveChart] = useState<string>(typeArr[0] || "");

    const total = useMemo(() => {
        return typeArr.reduce(
            (acc, key) => {
                acc[key] = data.reduce(
                    (sum, item) => sum + (Number(item[key]) || 0),
                    0,
                );
                return acc;
            },
            {} as Record<string, number>,
        );
    }, [data, typeArr]);

    return (
        <Card className={cn("py-0", styleWrapper)}>
            <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
                <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-6">
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap">
                    {typeArr.map((key) => {
                        return (
                            <button
                                key={key}
                                data-active={activeChart === key}
                                className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-t-0 sm:border-l sm:px-8 sm:py-6 cursor-pointer transition-colors"
                                onClick={() => setActiveChart(key)}
                            >
                                <span className="text-xs text-muted-foreground">
                                    {config[key]?.label}{" "}
                                </span>
                                <span className="text-lg leading-none font-bold sm:text-3xl">
                                    {(total[key] || 0).toLocaleString()}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </CardHeader>

            <CardContent className="px-2 sm:p-6">
                <ChartContainer
                    config={config}
                    className="aspect-auto h-[250px] w-full"
                >
                    <BarChart
                        accessibilityLayer
                        data={data}
                        margin={{
                            left: 12,
                            right: 12,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                                const date = new Date(value);
                                return date.toLocaleDateString("ru-RU", {
                                    month: "short",
                                    day: "numeric",
                                });
                            }}
                        />
                        <ChartTooltip
                            content={
                                <ChartTooltipContent
                                    className="w-[150px]"
                                    nameKey={activeChart}
                                    labelFormatter={(value) => {
                                        return new Date(value as string).toLocaleDateString("ru-RU", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        });
                                    }}
                                />
                            }
                        />
                        <Bar dataKey={activeChart} fill={`var(--color-${activeChart})`} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
};

interface ChartDetailsProps {
    title: string;
    description?: string;
    data: Array<Record<string, any>>;
    config: ChartConfig;
    xAxisKey: string;
    yAxisKey: string;
    footerTrending?: ReactNode;
    footerText?: string;
    styleWrapper?: string;
}

function ChartDetails({
    title,
    description,
    data,
    config,
    xAxisKey,
    yAxisKey,
    footerTrending,
    footerText,
    styleWrapper,
}: ChartDetailsProps) {
    const hasData = data && data.length > 0;

    return (
        <Card className={cn("w-full flex-1 min-w-[280px]", styleWrapper)}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>

            <CardContent>
                {hasData ? (
                    <ChartContainer config={config} className="min-h-[150px] w-full">
                        <BarChart
                            accessibilityLayer
                            data={data}
                            layout="vertical"
                            margin={{ left: 0, right: 30 }}
                        >
                            <YAxis
                                width={100}
                                dataKey={yAxisKey}
                                type="category"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                                tickFormatter={(value) => config[value]?.label || value}
                            />
                            <XAxis dataKey={xAxisKey} type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Bar dataKey={xAxisKey} radius={5}>
                                <LabelList
                                    dataKey={xAxisKey}
                                    position="right"
                                    offset={10}
                                    className="fill-foreground"
                                    fontSize={12}
                                    fontWeight={600}
                                    formatter={(value: any) => {
                                        const numValue = Number(value);
                                        if (isNaN(numValue)) return value;

                                        if (numValue > 5) {
                                            return `${numValue}%`;
                                        }
                                        return numValue;
                                    }}
                                />
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[150px] rounded-lg border border-dashed text-muted-foreground text-sm">
                        Нет данных для отображения
                    </div>
                )}
            </CardContent>

            {(footerTrending || footerText) && (
                <CardFooter className="flex-col items-start gap-2 text-sm">
                    {footerTrending && (
                        <div className="flex gap-2 leading-none font-medium">
                            {footerTrending}
                        </div>
                    )}
                    {footerText && (
                        <div className="leading-none text-muted-foreground">
                            {footerText}
                        </div>
                    )}
                </CardFooter>
            )}
        </Card>
    );
}

export interface AnalyticChartRow {
    key: string;
    label: string;
    value: number;
    fill?: string;
}

const FALLBACK_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
];

const defaultSelectData = (data: any[], activeMetric: string): AnalyticChartRow[] =>
    recordToChartRows(groupAndCount(data, activeMetric)).map((row) => ({
        key: String(row.key),
        label: String(row.key),
        value: Number(row.value),
    }));

interface AnalyticBarChartProps {
    title: string;
    description?: string;
    infoTitle?: string;
    infoDescription?: string;
    selectData?: (data: any[], activeMetric: string) => AnalyticChartRow[];
    valueFormatter?: (value: number) => string;
    footer?: ReactNode;
    styleWrapper?: string;
}

const AnalyticBarChart = ({
    title,
    description,
    infoTitle,
    infoDescription,
    selectData = defaultSelectData,
    footer,
    styleWrapper,
}: AnalyticBarChartProps) => {
    const { data, activeMetric } = useAnalyticContext();

    const rows = useMemo(() => selectData(data, activeMetric), [data, activeMetric, selectData]);

    const config = useMemo<ChartConfig>(
        () =>
            rows.reduce<ChartConfig>((acc, row, index) => {
                acc[row.key] = {
                    label: row.label,
                    color: row.fill ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
                };
                return acc;
            }, {}),
        [rows],
    );

    const hasData = rows.length > 0;

    return (
        <Card className={cn("w-full flex-1 min-w-[280px]", styleWrapper)}>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CardTitle>{title}</CardTitle>

                    {infoTitle && infoDescription && (
                        <CommonInfo title={infoTitle} description={infoDescription} style="size-5" />
                    )}
                </div>

                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>

            <CardContent>
                {hasData ? (
                    <ChartContainer config={config} className="min-h-[180px] w-full">
                        <BarChart
                            accessibilityLayer
                            data={rows}
                            layout="vertical"
                            margin={{ left: 0, right: 30 }}
                        >
                            <YAxis
                                width={110}
                                dataKey="key"
                                type="category"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                                tickFormatter={(value) => (config[value]?.label as string) || value}
                            />
                            <XAxis dataKey="value" type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel nameKey="key" />}
                            />
                            <Bar dataKey="value" radius={5}>
                                {rows.map((row) => (
                                    <Cell key={row.key} fill={row.fill ?? `var(--color-${row.key})`} />
                                ))}
                                <LabelList
                                    dataKey="value"
                                    position="right"
                                    offset={10}
                                    className="fill-foreground"
                                    fontSize={12}
                                    fontWeight={600}
                                />
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                ) : (
                    <div className="flex h-[180px] flex-col items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        Нет данных для отображения
                    </div>
                )}
            </CardContent>

            {footer && <CardFooter className="flex-col items-start gap-2 text-sm">{footer}</CardFooter>}
        </Card>
    );
};

export { CharCommontBar, ChartDetails, AnalyticBarChart };
