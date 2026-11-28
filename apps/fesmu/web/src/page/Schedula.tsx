import { Schedula } from "@/widgets/schedula";
import { PermissionGate } from "@/widgets/user-gate";
import { useUserProvider } from "@/features/provider/user.provider";
import { ACCESS } from "@/shared/config/access";
import { SCHEDULA_PERMISSIONS } from "@/shared/config/permissions";

export default function SchedulaPage() {
    const personal = useUserProvider((s) => s.hasRole(...ACCESS.STUDENT, ...ACCESS.TEACHER));
    return personal ? <Schedula /> : <PermissionGate permissions={SCHEDULA_PERMISSIONS}><Schedula /></PermissionGate>;
}
