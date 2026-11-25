import type { FC } from "react";
import { Loader2Icon } from "lucide-react";

interface CommonLoadingOverlayProps {
  title?: string;
  description?: string;
}

/** Drop-in replacement for a dialog/section's content while a multi-step
 * async action (e.g. fetch profile -> generate document) is in flight. */
const CommonLoadingOverlay: FC<CommonLoadingOverlayProps> = ({
  title = "Подождите...",
  description,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
};

export { CommonLoadingOverlay };
