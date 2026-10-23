import { cn } from "@/shared/lib/utils";

interface StatusBadgeProps {
  isDone: boolean;
}

export function StatusBadge({ isDone }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-sans",
        isDone
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-amber-500/10 text-amber-600",
      )}
    >
      {isDone ? "Обработана" : "В работе"}
    </span>
  );
}
