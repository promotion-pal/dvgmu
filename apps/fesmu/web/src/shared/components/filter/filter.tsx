import type { FC, PropsWithChildren } from "react";
import { SearchIcon, SlidersHorizontal } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface CommonFilterProps extends PropsWithChildren {
    count?: number;
    className?: string;
}

export const CommonFilter: FC<CommonFilterProps> = ({ count, children, className }) => {
    return (
        <section className={cn("w-fit flex flex-col md:flex-row items-start md:items-center gap-4 p-3 bg-muted/30 border border-border rounded-2xl", className)}>
            <div className="flex items-center gap-2.5 text-muted-foreground text-sm font-medium border-b md:border-b-0 md:border-r border-border pb-2 md:pb-0 md:pr-4 shrink-0">
                <SlidersHorizontal className="size-4 text-primary" />
                <span>Фильтры</span>

                {typeof count === "number" && (
                    <span className="flex items-center justify-center px-2 py-1 text-xs font-medium text-primary-foreground bg-primary rounded-full">
                        {count}
                    </span>
                )}
            </div>

            <div className="w-full flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    {children}
                </div>
            </div>
        </section>
    );
};

interface CommonSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const CommonSearchInput: FC<CommonSearchInputProps> = ({
    value,
    onChange,
    placeholder = "Поиск...",
    className,
}) => {
    return (
        <div className={cn("relative", className)}>
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="border rounded-lg pl-8 pr-3 py-2 w-72 bg-background text-sm"
            />
        </div>
    );
};
