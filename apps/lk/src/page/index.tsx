import { useEffect } from "react";
import { ArrowRight, BookOpen, ClipboardList, FileText } from "lucide-react";
import { NavLink, Route, Routes } from "react-router";
import { ROUTER } from "@/shared/config/path";
import { useUserProvider } from "@/features/provider/user.provider";
import { TicketsWidget } from "@/widgets/tickets";
import { Button } from "@/shared/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/shared/ui/card";
import { UserPermission, UserRole } from "@fesmu/contract/mdm/enum/user.enum_pb";
import { userHasPermission } from "@/features/provider/user.provider";

const modules = [
  {
    title: "Мои задачи",
    description: "Список задач",
    href: ROUTER.TASKS,
    icon: ClipboardList,
    color: "bg-blue-50 text-blue-700",
  },
  {
    title: "Обучение",
    description: "Учебная информация",
    href: ROUTER.EDUCATION,
    icon: BookOpen,
    color: "bg-violet-50 text-violet-700",
  },
  {
    title: "Документы",
    description: "Справки и документы",
    href: ROUTER.DOCUMENTS,
    icon: FileText,
    color: "bg-emerald-50 text-emerald-700",
  },
];

export function IndexPage() {
  return (
    <Routes>
      <Route path={ROUTER.INDEX} element={<DashboardPage />} />
      <Route path={ROUTER.PROFILE} element={<ProfilePage />} />
      <Route path={ROUTER.TASKS} element={<TicketsWidget />} />
      <Route path={ROUTER.EDUCATION} element={<SectionPage title="Обучение" />} />
      <Route path={ROUTER.DOCUMENTS} element={<SectionPage title="Документы" />} />
      <Route path={ROUTER.NOT_FOUND} element={<SectionPage title="Страница не найдена" />} />
    </Routes>
  );
}

function DashboardPage() {
  const { status, user } = useUserProvider();
  const canOpenTasks = userHasPermission(user, UserPermission.USER_TASK_READ) || userHasPermission(user, UserPermission.USER_TASK_CREATE);

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 text-slate-800 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Главная</h1>
        </header>

        <Card variant="horizontal" size="sm" className="w-full" role="region" aria-label="Профиль">
          <div className="flex min-w-0 flex-1 items-center gap-4 whitespace-nowrap">
            <div className="min-w-0">
              <h2 className="max-w-64 truncate text-base font-semibold text-slate-900">
                {status === "loading" ? "Загружаю…" : user ? `${user.firstName} ${user.lastName}` : "Профиль недоступен"}
              </h2>
            </div>
            {user && (
              <>
                <span className="hidden text-sm text-slate-600 lg:inline">{user.email || "Почта не указана"}</span>
                <span className="hidden text-sm text-slate-600 lg:inline">{user.phone || "Телефон не указан"}</span>
              </>
            )}
            {status === "error" && <span className="text-sm text-red-700">Не удалось загрузить пользователя</span>}
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
            ID: {user?.id.toString() ?? "—"}
          </span>
          <Button asChild size="lg" className="h-10 gap-2 rounded-lg bg-blue-700 px-4 text-white hover:bg-blue-800">
            <NavLink to={ROUTER.PROFILE}>
              Профиль
              <ArrowRight aria-hidden="true" />
            </NavLink>
          </Button>
        </Card>

        <section aria-labelledby="modules-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-semibold text-slate-900" id="modules-heading">Разделы</h2>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {modules.filter((module) => module.href !== ROUTER.TASKS || canOpenTasks).map(({ title, description, href, icon: Icon, color }) => (
              <NavLink
                className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                key={href}
                to={href}
              >
                <Card variant="interactive" className="h-full p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid size-11 place-items-center rounded-xl ${color}`}>
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <ArrowRight aria-hidden="true" className="mt-1 size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
                </Card>
              </NavLink>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfilePage() {
  const { status, user, availableUsers, fetchUsers, fetchById } = useUserProvider();
  const canManageUsers = user?.roles.includes(UserRole.ADMIN) ?? false;

  useEffect(() => {
    if (import.meta.env.DEV && canManageUsers) void fetchUsers();
  }, [canManageUsers, fetchUsers]);

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 text-slate-800 sm:px-6 sm:py-10">
      <Card className="mx-auto w-full max-w-5xl" size="lg">
        <CardHeader className="border-b border-slate-100">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Профиль</h1>
            <CardDescription className="mt-1">
              {status === "loading" ? "Загружаю данные…" : user ? `${user.firstName} ${user.lastName}` : "Не удалось загрузить пользователя"}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                ID: {user?.id.toString() ?? "—"}
              </span>
              {import.meta.env.DEV && canManageUsers && (
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  Тестовый профиль
                  <select
                    aria-label="Тестовый профиль"
                    className="max-w-44 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                    value={user?.id.toString() ?? ""}
                    onChange={(event) => void fetchById(BigInt(event.target.value))}
                  >
                    {availableUsers.map((candidate) => (
                      <option key={candidate.id.toString()} value={candidate.id.toString()}>
                        {candidate.firstName} {candidate.lastName} · {candidate.id.toString()}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </CardAction>
        </CardHeader>
        {user && (
          <CardContent>
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileField label="Имя" value={user.firstName} />
              <ProfileField label="Фамилия" value={user.lastName} />
              <ProfileField label="Отчество" value={user.patronymic || "Не указано"} />
              <ProfileField label="Электронная почта" value={user.email || "Не указана"} />
              <ProfileField label="Телефон" value={user.phone || "Не указан"} />
              <ProfileField
                label="Дата рождения"
                value={user.birthday ? new Date(Number(user.birthday.seconds) * 1000).toLocaleDateString("ru-RU") : "Не указана"}
              />
              <ProfileField label="UUID" value={user.uuid} />
              <ProfileField
                label="Роли"
                value={user.roles.map((role) => ({
                  [UserRole.STUDENT]: "STUDENT",
                  [UserRole.EMPLOYEE]: "EMPLOYEE",
                  [UserRole.ADMIN]: "ADMIN",
                } as Record<number, string>)[role]).filter(Boolean).join(", ") || "Не назначены"}
              />
              <ProfileField
                label="Доступы"
                value={user.permission?.permissions.map((permission) => ({
                  [UserPermission.USER_TASK_READ]: "TASK_READ",
                  [UserPermission.USER_TASK_CREATE]: "TASK_CREATE",
                  [UserPermission.USER_TASK_UPDATE]: "TASK_UPDATE",
                  [UserPermission.USER_TASK_DELETE]: "TASK_DELETE",
                } as Record<number, string>)[permission]).filter(Boolean).join(", ") || "Не назначены"}
              />
            </dl>
          </CardContent>
        )}
        {status === "error" && <CardContent><p className="text-sm text-red-700" role="alert">Не удалось загрузить данные пользователя.</p></CardContent>}
      </Card>
    </main>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-all text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function SectionPage({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 text-slate-800 sm:px-6 sm:py-14">
      <Card className="mx-auto w-full max-w-[720px]" size="lg">
        <CardHeader>
          <h1 className="m-0 text-2xl font-semibold text-slate-900">{title}</h1>
          <CardDescription>Раздел пока находится в разработке.</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
