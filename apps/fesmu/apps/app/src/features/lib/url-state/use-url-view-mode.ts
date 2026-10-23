import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CommonWrapperViewModeType } from "@/shared/components/wrapper";
import { urlCodec } from "./url-state.codec";
import { useUrlState } from "./use-url-state";
import type { UrlStateSchema } from "./use-url-state";

const VIEW_MODES = ["cards", "table"] as const satisfies readonly CommonWrapperViewModeType[];

/** Same shape as useCommonWrapperViewMode, but the chosen mode lives in the
 * URL (`?view=cards`), so a shared link opens in the same layout. */
export const useUrlViewMode = (initial: CommonWrapperViewModeType = "cards", key = "view") => {
  const schema = useMemo<UrlStateSchema<{ viewMode: CommonWrapperViewModeType }>>(
    () => ({ viewMode: { key, codec: urlCodec.oneOf(VIEW_MODES) } }),
    [key],
  );
  const fallback = useMemo(() => ({ viewMode: initial }), [initial]);
  const [state, setState] = useUrlState(schema, fallback);

  const setViewMode: Dispatch<SetStateAction<CommonWrapperViewModeType>> = (next) =>
    setState((current) => ({ viewMode: typeof next === "function" ? next(current.viewMode) : next }));

  return { viewMode: state.viewMode, setViewMode };
};
