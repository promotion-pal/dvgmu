import type { FC, ReactNode } from "react";

export interface PersonDetailRow {
    icon: ReactNode;
    label: string;
    value: string;
}

interface PersonDetailsProps {
    /** Badges shown above the row list (status, role, ...). */
    badges?: ReactNode;
    rows: PersonDetailRow[];
}

/** Common key/value details layout, reused by the User/Student/Employee
 * "Подробнее" views. */
const PersonDetails: FC<PersonDetailsProps> = ({ badges, rows }) => {
    return (
        <div className="flex flex-col gap-3">
            {badges && <div className="flex items-center gap-2">{badges}</div>}

            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {rows.map((row) => (
                    <div key={row.label} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <span className="text-muted-foreground shrink-0">{row.icon}</span>
                        <span className="text-muted-foreground min-w-32 shrink-0">{row.label}</span>
                        <span className="font-medium text-slate-800 break-all">{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export { PersonDetails };
