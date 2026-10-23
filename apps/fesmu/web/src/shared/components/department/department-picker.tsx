import { useMemo, useState } from "react";
import type { FC, ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type { UserEmployeeDepartment } from "@fesmu/contract/enum/user.enum_pb";
import { DEPARTMENT_LABEL, DEPARTMENT_OPTIONS } from "@/shared/config/departments";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import type { DepartmentFilterValue } from "./department-filter";

/** Список подразделений с поиском — общая часть выбора одного и нескольких. */
const DepartmentList: FC<{
    isSelected: (d: UserEmployeeDepartment) => boolean;
    onPick: (d: UserEmployeeDepartment) => void;
    top?: ReactNode;
}> = ({ isSelected, onPick, top }) => {
    const [query, setQuery] = useState("");
    const options = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? DEPARTMENT_OPTIONS.filter((o) => o.label.toLowerCase().includes(q)) : DEPARTMENT_OPTIONS;
    }, [query]);

    return (
        <div className="flex flex-col gap-2">
            <Input autoFocus placeholder="Найти подразделение" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="max-h-72 overflow-y-auto">
                {!query && top}
                {options.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Ничего не найдено</p>}
                {options.map((o) => (
                    <OptionRow key={o.value} selected={isSelected(o.value)} onClick={() => onPick(o.value)}>
                        {o.label}
                    </OptionRow>
                ))}
            </div>
        </div>
    );
};

const OptionRow: FC<{ selected: boolean; onClick: () => void; children: ReactNode }> = ({ selected, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
            selected && "font-medium",
        )}
    >
        <CheckIcon className={cn("mt-0.5 size-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
        <span>{children}</span>
    </button>
);

interface DepartmentMultiPickerProps {
    value: UserEmployeeDepartment[];
    onChange: (value: UserEmployeeDepartment[]) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

/** Несколько подразделений: человек в подразделениях, доступ для подразделений. */
export const DepartmentMultiPicker: FC<DepartmentMultiPickerProps> = ({ value, onChange, disabled, placeholder = "—", className }) => {
    const toggle = (d: UserEmployeeDepartment) =>
        onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
    const summary =
        value.length === 0 ? placeholder : value.length === 1 ? DEPARTMENT_LABEL[value[0]] : `${value.length} подразделения`;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    title={value.map((d) => DEPARTMENT_LABEL[d]).join("\n")}
                    className={cn("h-auto min-h-8 max-w-64 justify-between gap-1 px-2 py-1 text-left font-normal", className)}
                >
                    <span className={cn("line-clamp-2 whitespace-normal", value.length === 0 && "text-muted-foreground")}>{summary}</span>
                    <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96">
                <DepartmentList isSelected={(d) => value.includes(d)} onPick={toggle} />
                {value.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange([])}>
                        Убрать все ({value.length})
                    </Button>
                )}
            </PopoverContent>
        </Popover>
    );
};

interface DepartmentFilterProps {
    value: DepartmentFilterValue;
    onChange: (value: DepartmentFilterValue) => void;
    /** false — только подразделения, без «Все»/«Без подразделения» (выбор одного). */
    withAll?: boolean;
}

/** Фильтр списка по одному подразделению. */
export const DepartmentFilter: FC<DepartmentFilterProps> = ({ value, onChange, withAll = true }) => {
    const [open, setOpen] = useState(false);
    const pick = (v: DepartmentFilterValue) => {
        onChange(v);
        setOpen(false);
    };
    const label =
        value === "all" ? (withAll ? "Все подразделения" : "Выберите подразделение") : value === "none" ? "Без подразделения" : DEPARTMENT_LABEL[value];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-auto min-w-48 max-w-72 justify-between font-normal">
                    <span className="truncate">{label}</span>
                    <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96">
                <DepartmentList
                    isSelected={(d) => value === d}
                    onPick={pick}
                    top={
                        withAll && (
                        <>
                            <OptionRow selected={value === "all"} onClick={() => pick("all")}>Все подразделения</OptionRow>
                            <OptionRow selected={value === "none"} onClick={() => pick("none")}>Без подразделения</OptionRow>
                        </>
                        )
                    }
                />
            </PopoverContent>
        </Popover>
    );
};
