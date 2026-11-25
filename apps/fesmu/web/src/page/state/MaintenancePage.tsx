import { ROUTE } from "@/shared/config/path";
import { Link } from "react-router-dom";
import { Wrench, Clock, AlertCircle } from "lucide-react";

export function MaintenancePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="container text-center">
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="w-12 h-12 text-primary animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center border-2 border-yellow-500/30">
                <Clock className="w-4 h-4 text-yellow-500" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-6xl md:text-7xl font-bold text-primary">
              Технические работы
            </h1>
            <p className="text-muted-foreground text-lg">
              Мы обновляем сервис для вашего удобства
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-foreground/60 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Ориентировочное время: 15-30 минут</span>
          </div>

          <p className="text-foreground/70 max-w-md mx-auto">
            В данный момент ведутся плановые технические работы.
            Пожалуйста, зайдите позже. Приносим извинения за временные неудобства.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={ROUTE.HOME}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Попробовать снова
            </Link>
            <a
              href="mailto:support@company.com"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Связаться с поддержкой
            </a>
          </div>

          <div className="max-w-xs mx-auto mt-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Идет обновление</span>
              <span>~80%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-1000 animate-pulse"
                style={{ width: '80%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}