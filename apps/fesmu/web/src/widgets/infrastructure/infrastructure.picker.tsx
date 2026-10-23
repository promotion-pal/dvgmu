import type { Infrastructure } from "@dvgmu/contract/entity/v1/infrastructure.entity_pb";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import type { FC } from "react";
import { useMemo, useState } from "react";
import { floorLabel, groupByFloor, matchesSearch, sortInfrastructure } from "./infrastructure.filter";

interface InfrastructurePickerProps {
    list: Infrastructure[];
    value?: bigint;
    onChange: (value: bigint | undefined) => void;
    allLabel?: string;
    className?: string;
}

/** Room filter for long room lists: a search box over the rooms grouped by
 * floor, in place of a plain dropdown of a couple of hundred lines. */
const InfrastructurePicker: FC<InfrastructurePickerProps> = ({
    list,
    value,
    onChange,
    allLabel = "Все помещения",
    className,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const sorted = useMemo(() => sortInfrastructure(list), [list]);
    const groups = useMemo(() => {
        const query = search.trim().toLowerCase();
        return groupByFloor(sorted.filter((item) => matchesSearch(item, query)));
    }, [sorted, search]);

    const selected = value !== undefined ? list.find((item) => item.id === value) : undefined;

    const choose = (next: bigint | undefined) => {
        onChange(next);
        setOpen(false);
        setSearch("");
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex h-9 min-w-60 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm",
                        className,
                    )}
                >
                    <span className={cn("truncate", !selected && "text-muted-foreground")}>
                        {selected ? `${selected.title}${selected.floor ? ` · ${selected.floor} эт.` : ""}` : allLabel}
                    </span>
                    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                </button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-72 gap-2 p-2">
                <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        autoFocus
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Номер или название"
                        className="h-8 pl-8"
                    />
                </div>

                <div className="max-h-80 overflow-y-auto">
                    <PickerOption label={allLabel} active={value === undefined} onClick={() => choose(undefined)} />

                    {groups.map((group) => (
                        <div key={group.floor}>
                            <p className="sticky top-0 bg-popover px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                                {floorLabel(group.floor)}
                            </p>
                            {group.items.map((item) => (
                                <PickerOption
                                    key={item.id.toString()}
                                    label={item.title}
                                    active={item.id === value}
                                    onClick={() => choose(item.id)}
                                />
                            ))}
                        </div>
                    ))}

                    {groups.length === 0 && (
                        <p className="px-2 py-3 text-center text-xs text-muted-foreground">Ничего не найдено</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

interface PickerOptionProps {
    label: string;
    active: boolean;
    onClick: () => void;
}
const PickerOption: FC<PickerOptionProps> = ({ label, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
            active && "font-medium",
        )}
    >
        <span className="truncate">{label}</span>
        {active && <CheckIcon className="size-4 shrink-0" />}
    </button>
);

export { InfrastructurePicker };
