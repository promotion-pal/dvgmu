import type { FC, ReactNode } from "react";
import type { PermissionSection } from "@/shared/config/permissions";
import { PermissionAction } from "@/shared/config/permissions";
import { useCan } from "./use-can";

interface CanProps {
    section: PermissionSection;
    /** По умолчанию — изменение (post): кнопки «Добавить/Изменить/Удалить». */
    action?: PermissionAction;
    /** Что показать без права; по умолчанию ничего. */
    fallback?: ReactNode;
    children: ReactNode;
}

/** Универсальная обёртка: показывает содержимое только с правом на раздел.
 *  <Can section={PermissionSection.SCHEDULE}><Button>Удалить</Button></Can> */
export const Can: FC<CanProps> = ({ section, action = PermissionAction.POST, fallback = null, children }) =>
    useCan(section, action) ? <>{children}</> : <>{fallback}</>;
