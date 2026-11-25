"use client";

import { cn } from "@/shared/lib/utils";
import { LayoutGrid, Table2 } from "lucide-react";

export type EntityViewMode = "table" | "card";

interface ViewSwitcherProps {
  value: EntityViewMode;
  onChange: (value: EntityViewMode) => void;
}

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-input p-0.5">
      <button
        type="button"
        aria-label="Таблица"
        aria-pressed={value === "table"}
        onClick={() => onChange("table")}
        className={cn(
          "flex size-7 items-center justify-center rounded-md transition-colors",
          value === "table"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Table2 className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Карточки"
        aria-pressed={value === "card"}
        onClick={() => onChange("card")}
        className={cn(
          "flex size-7 items-center justify-center rounded-md transition-colors",
          value === "card"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="size-4" />
      </button>
    </div>
  );
}
