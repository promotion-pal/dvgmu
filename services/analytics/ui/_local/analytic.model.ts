import type { Analytic } from "./analytic.proto";

export interface UseAnalyticParams {
  id: number;
}

export interface UseAnalyticResult extends Partial<Analytic> {
  isLoading: boolean;
}

export const useAnalytic = (_params: UseAnalyticParams): UseAnalyticResult => ({
  isLoading: false,
});
