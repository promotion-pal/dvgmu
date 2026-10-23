import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { MoreVerticalIcon } from "lucide-react";
import type { FC, ReactNode } from "react";

export interface CommonPopoverItem {
    label: string;
    icon?: ReactNode;
    style?: string;
    onClick: () => void;
}

export interface CommonPopoverProps {
    items: CommonPopoverItem[];
}

const CommonPopover: FC<CommonPopoverProps> = ({ items }) => {
    if (items.length === 0) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <MoreVerticalIcon className="size-4" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
                {items.map((item, index) => (
                    <DropdownMenuItem
                        key={`${item.label}-${index}`}
                        className={cn("gap-2", item.style)}
                        onClick={(e) => {
                            e.stopPropagation();
                            item.onClick();
                        }}
                    >
                        {item.icon}
                        {item.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export { CommonPopover };
