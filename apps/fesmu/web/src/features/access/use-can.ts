import { useUserProvider } from "@/features/provider/user.provider";
import type { PermissionSection } from "@/shared/config/permissions";
import { PermissionAction, permsFor } from "@/shared/config/permissions";

/** Может ли текущий пользователь action в разделе (по умолчанию — изменять). ADMIN — всегда. */
export const useCan = (section: PermissionSection, action: PermissionAction = PermissionAction.POST) =>
    useUserProvider((s) => s.hasPermission(...permsFor(section, action)));
