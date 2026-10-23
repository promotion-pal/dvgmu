import type { FC, ReactNode } from "react";
import { LogOutIcon } from "lucide-react";
import { UserRole } from "@fesmu/contract/enum/v1/user.enum_pb";
import { CommonWrapper } from "@/shared/components/wrapper";
import { summarizePermissions } from "@/shared/config/permissions";
import { signOut } from "@/shared/config/session";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { useUserProvider } from "@/features/provider/user.provider";

const ROLE_LABEL: Record<UserRole, string> = {
    [UserRole.UNSPECIFIED]: "—",
    [UserRole.ADMIN]: "Администратор",
    [UserRole.STAFF]: "Сотрудник",
    [UserRole.STUDENT]: "Студент",
    [UserRole.TEACHER]: "Преподаватель",
};

const Row: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
    <div className="grid grid-cols-1 gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[200px_1fr]">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="break-all">{children}</span>
    </div>
);

/** Who is signed in: the MDM user behind the session (roles come from MDM). */
export default function ProfilePage() {
    const user = useUserProvider((s) => s.user);
    const profile = useUserProvider((s) => s.profile);
    // Технические поля — только администратору; остальным — минимум.
    const isAdmin = useUserProvider((s) => s.hasRole(UserRole.ADMIN));
    const fullName = profile ? `${profile.lastName} ${profile.firstName}`.trim() : "";

    return (
        <CommonWrapper
            title="Профиль"
            description="Под какой учётной записью вы вошли"
            action={
                <Button variant="outline" onClick={signOut}>
                    <LogOutIcon className="size-4" />
                    Выйти
                </Button>
            }
        >
            <Card>
                <CardContent className="py-2">
                    <Row label="ФИО">{fullName || "—"}</Row>
                    <Row label="Логин (AD)"><span className="font-mono">{profile?.username || "—"}</span></Row>
                    <Row label="Email">{profile?.email || "—"}</Row>
                    <Row label="Роли">
                        {user && user.roles.length > 0 ? (
                            <span className="flex flex-wrap gap-2">
                                {user.roles.map((role) => (
                                    <Badge key={role} variant="secondary">{ROLE_LABEL[role]}</Badge>
                                ))}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">нет — назначает администратор в «Роли»</span>
                        )}
                    </Row>
                    <Row label="Права">
                        {isAdmin ? (
                            <span>все (администратор)</span>
                        ) : user && user.permissions.length > 0 ? (
                            <span className="flex flex-wrap gap-2">
                                {summarizePermissions(user.permissions).map((label) => (
                                    <Badge key={label} variant="outline">
                                        {label}
                                    </Badge>
                                ))}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">нет</span>
                        )}
                    </Row>
                    {isAdmin && (
                        <>
                            <Row label="UUID (MDM)"><span className="font-mono text-xs">{user?.uuid || "—"}</span></Row>
                            <Row label="ID в MDM"><span className="font-mono text-xs">{user?.mdmId ? user.mdmId.toString() : "—"}</span></Row>
                            <Row label="Вход">Доменная учётная запись (AD) через auth.fesmu.ru</Row>
                        </>
                    )}
                </CardContent>
            </Card>
        </CommonWrapper>
    );
}
