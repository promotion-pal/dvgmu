import { Link } from "react-router-dom";
import { UserRole } from "@fesmu/contract/fesmu/enum/v1/user.enum_pb";

import { useUserProvider } from "@/features/provider/user.provider";
import { CommonWrapper } from "@/shared/components/wrapper";
import { summarizePermissions } from "@/shared/config/permissions";
import { ROUTE } from "@/shared/config/path";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { visibleGroups } from "@/widgets/layout/sidebar";

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.UNSPECIFIED]: "Не назначена",
  [UserRole.ADMIN]: "Администратор",
  [UserRole.STAFF]: "Сотрудник",
  [UserRole.STUDENT]: "Студент",
  [UserRole.TEACHER]: "Преподаватель",
};

export default function HomePage() {
  const user = useUserProvider((state) => state.user);
  const profile = useUserProvider((state) => state.profile);
  const hasRole = useUserProvider((state) => state.hasRole);
  const hasPermission = useUserProvider((state) => state.hasPermission);
  const modules = visibleGroups(hasRole, hasPermission);
  const fullName = [profile?.lastName, profile?.firstName].filter(Boolean).join(" ");

  return (
    <CommonWrapper
      title={`Здравствуйте${fullName ? `, ${fullName}` : ""}!`}
      description="Личный кабинет ДВГМУ: ваши данные и доступные разделы собраны на одной странице."
    >
      <Card className="mb-6 gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Пользователь</p>
            <h2 className="mt-1 break-words text-xl font-semibold">{fullName || profile?.username || "Профиль не заполнен"}</h2>
            {profile?.email && <p className="mt-1 break-all text-sm text-muted-foreground">{profile.email}</p>}
            {profile?.username && <p className="mt-1 text-sm text-muted-foreground">Учётная запись: <span className="font-mono">{profile.username}</span></p>}
          </div>
          <Link to={ROUTE.USER.PROFILE} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Открыть профиль</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="mr-1 text-sm text-muted-foreground">Роли и доступы</span>
          {user?.roles.length ? user.roles.map((role) => (
            <Badge key={role} variant="secondary">{ROLE_LABEL[role] ?? "Роль"}</Badge>
          )) : <Badge variant="outline">Права не назначены</Badge>}
          {!user?.roles.includes(UserRole.ADMIN) && summarizePermissions(user?.permissions ?? []).map((permission) => (
            <Badge key={permission} variant="outline">{permission}</Badge>
          ))}
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold">Доступные модули</h2>
          <p className="text-sm text-muted-foreground">Показаны только разделы, открытые для вашей учётной записи.</p>
        </div>
        <span className="text-xs text-muted-foreground">{modules.reduce((sum, group) => sum + group.items.length, 0)} разделов</span>
      </div>

      {modules.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((group) => (
            <Card key={group.label} className="gap-3 p-4">
              <h3 className="font-heading text-base font-semibold">{group.label}</h3>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.url} to={item.url} className="flex min-w-0 items-center gap-3 rounded-lg p-2.5 text-sm hover:bg-muted">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">{item.title}</span>
                      <span aria-hidden="true" className="text-muted-foreground">↗</span>
                    </Link>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Для вашей учётной записи пока не назначены доступы к модулям. Обратитесь к администратору.
        </Card>
      )}
    </CommonWrapper>
  );
}
