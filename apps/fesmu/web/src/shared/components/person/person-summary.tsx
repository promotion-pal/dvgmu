import type { FC, ReactNode } from "react";
import { UserIcon, MailIcon, PhoneIcon } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { CommonPopover } from "@/shared/components/menu";
import type { CommonPopoverProps } from "@/shared/components/menu";

interface PersonSummaryProps {
    fullName: string;
    email?: string;
    phone?: string;
    /** Status/role badges rendered next to the popover trigger. */
    badges?: ReactNode;
    /** Extra chips on the contact-info row (group, department, ...). */
    extra?: ReactNode;
    menuItems?: CommonPopoverProps["items"];
    selected?: boolean;
    onToggleSelect?: () => void;
}

/** Common card shell for a person (user/student/employee) list item — the
 * icon+name+badges+menu header row and the email/phone/extra info row. */
const PersonSummary: FC<PersonSummaryProps> = ({
    fullName,
    email,
    phone,
    badges,
    extra,
    menuItems,
    selected,
    onToggleSelect,
}) => {
    return (
        <Card className="p-4 border border-slate-100 rounded-xl shadow-sm bg-white hover:border-slate-200 transition-colors">
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                    <p className="icon-inline gap-2 font-semibold text-base text-slate-800 tracking-tight">
                        {onToggleSelect && (
                            <Checkbox
                                checked={selected ?? false}
                                onCheckedChange={onToggleSelect}
                                onClick={(e) => e.stopPropagation()}
                            />
                        )}
                        <UserIcon className="size-4 text-muted-foreground shrink-0" />
                        {fullName}
                    </p>

                    <div className="flex items-center gap-2 shrink-0">
                        {badges}
                        {menuItems && <CommonPopover items={menuItems} />}
                    </div>
                </div>

                {(email || phone || extra) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        {email && (
                            <span className="icon-inline gap-1">
                                <MailIcon className="size-3" />
                                {email}
                            </span>
                        )}
                        {phone && (
                            <span className="icon-inline gap-1">
                                <PhoneIcon className="size-3" />
                                {phone}
                            </span>
                        )}
                        {extra}
                    </div>
                )}
            </div>
        </Card>
    );
};

export { PersonSummary };
export type { PersonSummaryProps };
