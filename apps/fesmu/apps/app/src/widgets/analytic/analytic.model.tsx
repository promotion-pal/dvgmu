/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import { cn } from "@/shared/lib/utils";
import type { ChartConfig } from "@/shared/ui/chart";
import type { ReactNode} from "react";
import { createContext, useContext, useMemo, useState } from "react";

export interface AnalyticContextValue {
  data: any[];
  config: ChartConfig;
  activeMetric: string;
  setActiveMetric: (metric: string) => void;
}

const AnalyticContext = createContext<AnalyticContextValue | null>(null);

export const useAnalyticContext = (): AnalyticContextValue => {
  const context = useContext(AnalyticContext);

  if (!context) {
    throw new Error(
      "Analytic compound components must be rendered within <AnalyticRoot>",
    );
  }

  return context;
};

export interface AnalyticRootProps {
  data: any[];
  config: ChartConfig;
  initialMetric?: string;
  styleWrapper?: string;
  children: ReactNode;
}

const AnalyticRoot = ({
  data,
  config,
  initialMetric,
  styleWrapper,
  children,
}: AnalyticRootProps) => {
  const [activeMetric, setActiveMetric] = useState<string>(
    initialMetric ?? Object.keys(config)[0] ?? "",
  );

  const value = useMemo<AnalyticContextValue>(
    () => ({ data, config, activeMetric, setActiveMetric }),
    [data, config, activeMetric],
  );

  return (
    <AnalyticContext.Provider value={value}>
      <div className={cn(styleWrapper)}>{children}</div>
    </AnalyticContext.Provider>
  );
};

export { AnalyticRoot };
