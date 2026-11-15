import type { FC, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { CommonEmpty } from "./empty";
import { CommonError } from "./error";
import { CommonSkeleton } from "./skeleton";

export interface CommonControlState {
  isError: boolean;
  isEmpty: boolean;
  isLoading: boolean;
}

interface CommonControlStateProps extends CommonControlState {
  error?: ReactNode;
  empty?: ReactNode;
  loading?: ReactNode;
  children?: ReactNode;
  styleWrapper?: string;
}

const CommonControlState: FC<CommonControlStateProps> = ({
  error = <CommonError />,
  isError,
  loading = <CommonSkeleton />,
  isLoading,
  empty = <CommonEmpty />,
  isEmpty,
  children,
  styleWrapper,
}) => {
  return (
    // min-height keeps the page from jolting when a live filter shrinks the
    // list down to empty/error content that's much shorter than the grid.
    <section className={cn("min-h-40", styleWrapper)}>
      {isError ? error : isLoading ? loading : isEmpty ? empty : children}
    </section>
  );
};

export { CommonControlState };
