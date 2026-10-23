"use client";

import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";
import { MoreVertical } from "lucide-react";
import { MouseEvent, ReactNode } from "react";

interface ActionMenuProps {
  children: ReactNode;
  align?: "start" | "center" | "end";
  label?: string;
}

export function ActionMenu({
  children,
  align = "end",
  label = "Действия",
}: ActionMenuProps) {
  return (
    <Popover>
      <PopoverTrigger
        onClick={(event: MouseEvent) => event.stopPropagation()}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
          />
        }
      >
        <MoreVertical />
      </PopoverTrigger>
      <PopoverContent align={align}>{children}</PopoverContent>
    </Popover>
  );
}

interface ActionMenuItemProps {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function ActionMenuItem({
  children,
  onClick,
  icon,
  destructive,
  disabled,
}: ActionMenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        destructive && "text-destructive hover:text-destructive",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
