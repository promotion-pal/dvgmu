import { ROUTE } from "@/shared/config/path";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="container text-center">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-8xl font-bold text-primary">404</h1>
            <p className="text-muted-foreground text-lg">Страница не найдена</p>
          </div>

          <p className="text-foreground/70 max-w-md mx-auto">
            Извините, страница, которую вы ищете, не существует или была
            перемещена.
          </p>

          <div className="pt-4">
            <Link
              to={ROUTE.HOME}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
