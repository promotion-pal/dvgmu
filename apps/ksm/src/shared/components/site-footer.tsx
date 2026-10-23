import Link from "next/link";
import { Clock, Mail, MapPin, Phone, Stethoscope } from "lucide-react";
import { appConfig, footerNav } from "@/shared/config/app";

const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;

export function SiteFooter() {
  const half = Math.ceil(footerNav.length / 2);

  return (
    <footer className="mt-auto bg-foreground text-background">
      <div className="container mx-auto grid grid-cols-1 gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">{appConfig.name}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-background/70">
            {appConfig.fullName} — структурное подразделение {appConfig.parentOrg}.
          </p>
          <div className="mt-4 space-y-2 text-sm text-background/80">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {appConfig.address.full}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              <a href={tel(appConfig.phones[0].number)}>{appConfig.phones[0].number}</a>,{" "}
              <a href={tel(appConfig.phones[1].number)}>{appConfig.phones[1].number}</a>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              <a href={`mailto:${appConfig.email}`}>{appConfig.email}</a>
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              Будни 08:00–20:00, суббота 09:00–14:00
            </p>
          </div>
        </div>

        <nav className="text-sm">
          <p className="mb-3 font-semibold">Разделы</p>
          <ul className="space-y-2">
            {footerNav.slice(0, half).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-background/70 transition-colors hover:text-primary"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="text-sm">
          <p className="mb-3 font-semibold">Информация</p>
          <ul className="space-y-2">
            {footerNav.slice(half).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-background/70 transition-colors hover:text-primary"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-background/15">
        <div className="container mx-auto px-4 py-6 text-center text-xs text-background/60">
          <p>
            © {new Date().getFullYear()} {appConfig.fullName}. Лицензия {appConfig.license}.
          </p>
          <p className="mt-1">
            Материалы перенесены с официального сайта {appConfig.source}. Список
            врачей, графики работы и прейскурант уточняйте в регистратуре.
          </p>
        </div>
      </div>
    </footer>
  );
}
