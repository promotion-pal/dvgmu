import type { FC, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

interface FieldProps {
    label: string;
    className?: string;
    children: ReactNode;
}

/** Small caption-over-control wrapper shared by the filter controls. */
const CommonFilterField: FC<FieldProps> = ({ label, className, children }) => (
    <div className={cn("flex flex-col gap-1", className)}>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {children}
    </div>
);

// Radix Select can't have an empty-string item, so "no selection" is a sentinel.
const ALL_VALUE = "__all__";

interface CommonFilterSelectProps {
    label: string;
    value?: string;
    onChange: (value: string | undefined) => void;
    options: { value: string; label: string }[];
    /** Label of the "nothing chosen" option; omit to make a choice mandatory. */
    allLabel?: string;
    className?: string;
}

export const CommonFilterSelect: FC<CommonFilterSelectProps> = ({ label, value, onChange, options, allLabel, className }) => (
    <CommonFilterField label={label} className={className}>
        <Select value={value ?? ALL_VALUE} onValueChange={(next) => onChange(next === ALL_VALUE ? undefined : next)}>
            <SelectTrigger className="h-9 min-w-40 bg-background">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {allLabel && <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>}
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </CommonFilterField>
);

interface CommonFilterChipsProps<T extends string | number> {
    label: string;
    options: { value: T; label: string }[];
    value: T[];
    onChange: (value: T[]) => void;
    className?: string;
}

/** Multi-select as a row of toggle chips — for short option lists (weekdays,
 * a dozen subjects) where a dropdown would hide what's on offer. An empty
 * selection means "no restriction". */
export function CommonFilterChips<T extends string | number>({ label, options, value, onChange, className }: CommonFilterChipsProps<T>) {
    const toggle = (option: T) => onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);

    return (
        <CommonFilterField label={label} className={className}>
            <div className="flex flex-wrap gap-1.5">
                {options.map((option) => {
                    const active = value.includes(option.value);
                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggle(option.value)}
                            className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </CommonFilterField>
    );
}

interface CommonFilterDateRangeProps {
    label: string;
    from?: string;
    to?: string;
    min?: string;
    max?: string;
    onChange: (range: { from?: string; to?: string }) => void;
    className?: string;
}

/** Two native date inputs (ISO `YYYY-MM-DD`). A `from` without a `to` is a single day. */
export const CommonFilterDateRange: FC<CommonFilterDateRangeProps> = ({ label, from, to, min, max, onChange, className }) => (
    <CommonFilterField label={label} className={className}>
        <div className="flex items-center gap-1.5">
            <Input
                type="date"
                aria-label={`${label}: с`}
                value={from ?? ""}
                min={min}
                max={max}
                onChange={(event) => onChange({ from: event.target.value || undefined, to })}
                className="h-9 w-auto bg-background"
            />
            <span className="text-muted-foreground">–</span>
            <Input
                type="date"
                aria-label={`${label}: по`}
                value={to ?? ""}
                min={from ?? min}
                max={max}
                onChange={(event) => onChange({ from, to: event.target.value || undefined })}
                className="h-9 w-auto bg-background"
            />
        </div>
    </CommonFilterField>
);
