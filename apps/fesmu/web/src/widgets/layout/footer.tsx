import { BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Link } from "react-router-dom";
import { appConfig } from "@/shared/config/app";
import { ROUTE } from "@/shared/config/path";

export const Footer = () => {
  return (
    <footer className="w-full border-t bg-background text-muted-foreground mt-auto">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row sm:h-14 sm:py-0">
        <div className="flex items-center gap-2 text-sm">
          <p className="font-medium text-foreground/80">{appConfig.fullName}</p>

          <span className="text-muted-foreground/40">|</span>
          <span>{appConfig.year}</span>
          <span className="text-muted-foreground/40">|</span>

          <p className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-md font-mono">
            {appConfig.version}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs"
          >
            <Link to={ROUTE.DOCS.COMMON}>
              <BookOpenIcon className="h-3.5 w-3.5" />
              <span>Перейти к документации</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs"
          >
            <a
              href="https://wiki.dvgmu.promotion-pal.ru"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              <span>База знаний (wiki)</span>
            </a>
          </Button>
        </div>
      </div>
    </footer>
  );
};
