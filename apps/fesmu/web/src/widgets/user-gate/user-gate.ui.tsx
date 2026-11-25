import type { FC, ReactNode } from "react";
import { ExternalLinkIcon, KeyRoundIcon, LogInIcon, LogOutIcon, RefreshCwIcon, ShieldXIcon, UserXIcon } from "lucide-react";
import type { UserRole } from "@fesmu/contract/fesmu/enum/v1/user.enum_pb";
import { appConfig } from "@/shared/config/app";
import { activate, signIn, signOut } from "@/shared/config/session";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { useLoadUser, useUserProvider } from "@/features/provider/user.provider";

const HELP_DESK_URL = "https://hd.fesmu.ru";
// Вход в Yandex 360 идёт через ту же форму auth (SAML) и заодно выдаёт
// сессию fesmu — после него достаточно вернуться и нажать «Продолжить».
const YANDEX_360_URL = "https://360.yandex.ru";

const GateCard: FC<{ icon: ReactNode; text: ReactNode; children: ReactNode }> = ({ icon, text, children }) => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
            <CardContent className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    {icon}
                </div>
                <h1 className="text-lg font-semibold">{appConfig.name}</h1>
                <p className="text-sm text-muted-foreground">{text}</p>
                <div className="flex w-full flex-col gap-2">{children}</div>
            </CardContent>
        </Card>
    </main>
);

/** Lets in only a signed-in user linked to MDM; offers everyone else a sign-in. */
const UserGate: FC<{ children: ReactNode }> = ({ children }) => {
    const provider = useLoadUser();

    switch (provider.status) {
        case "ready":
            return <>{children}</>;
        case "signedOut":
            return (
                <GateCard
                    icon={<LogInIcon className="size-5" />}
                    text="Авторизуйтесь доменной учётной записью: на странице входа или через Яндекс 360 под рабочей почтой. Первый раз — войдите по коду активации от администратора и задайте свой пароль."
                >
                    <Button onClick={() => signIn()}>
                        <LogInIcon className="size-4" />
                        Войти
                    </Button>
                    <Button variant="outline" asChild>
                        <a href={YANDEX_360_URL} target="_blank" rel="noreferrer">
                            Войти через Яндекс&nbsp;360
                            <ExternalLinkIcon className="size-4" />
                        </a>
                    </Button>
                    <Button variant="outline" onClick={() => activate(window.location.origin + ROUTE.USER.PROFILE)}>
                        <KeyRoundIcon className="size-4" />
                        Первый вход по коду
                    </Button>
                    <Button variant="ghost" onClick={() => provider.load(true)}>
                        <RefreshCwIcon className="size-4" />
                        Я вошёл — продолжить
                    </Button>
                </GateCard>
            );
        case "notLinked":
            return (
                <GateCard
                    icon={<UserXIcon className="size-5" />}
                    text="Вход выполнен, но ваша учётная запись не связана с MDM, поэтому доступа к разделам нет. Обратитесь в Help Desk."
                >
                    <Button asChild>
                        <a href={HELP_DESK_URL} target="_blank" rel="noreferrer">
                            Открыть Help Desk
                            <ExternalLinkIcon className="size-4" />
                        </a>
                    </Button>
                    <Button variant="outline" onClick={() => provider.load(true)}>
                        <RefreshCwIcon className="size-4" />
                        Проверить снова
                    </Button>
                    <Button variant="ghost" onClick={signOut}>
                        <LogOutIcon className="size-4" />
                        Выйти
                    </Button>
                </GateCard>
            );
        case "unknown":
            return (
                <GateCard icon={<RefreshCwIcon className="size-5" />} text="Сервис входа временно недоступен.">
                    <Button onClick={() => provider.load(true)}>Повторить</Button>
                </GateCard>
            );
        default:
            // idle / loading
            return null;
    }
};

/** Inside UserGate: the page only for the given roles (ADMIN passes every check). */
const RoleGate: FC<{ roles: UserRole[]; children: ReactNode }> = ({ roles, children }) => {
    const allowed = useUserProvider((s) => s.hasRole(...roles));
    if (allowed) return <>{children}</>;
    return (
        <GateCard icon={<ShieldXIcon className="size-5" />} text="Недостаточно прав для этого раздела.">
            <Button variant="outline" onClick={() => window.history.back()}>
                Назад
            </Button>
        </GateCard>
    );
};

/** Inside UserGate: the page only with one of the rights (ADMIN has all). */
const PermissionGate: FC<{ permissions: string[]; children: ReactNode }> = ({ permissions, children }) => {
    const allowed = useUserProvider((s) => s.hasPermission(...permissions));
    if (allowed) return <>{children}</>;
    return (
        <GateCard icon={<ShieldXIcon className="size-5" />} text="Нет права на этот раздел. Его выдаёт администратор.">
            <Button variant="outline" onClick={() => window.history.back()}>
                Назад
            </Button>
        </GateCard>
    );
};

export { PermissionGate, RoleGate, UserGate };
