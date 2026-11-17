import { useState, type ReactNode } from "react";
import { NavLink } from "react-router";
import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  Command,
  FileText,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  UserRound,
  X,
} from "lucide-react";

const navigation = [
  { title: "Мои задачи", icon: ClipboardList, href: "/tasks" },
];

const workspaceItems = [
  { title: "Обучение", icon: BookOpen, href: "/education" },
  { title: "Документы", icon: FileText, href: "/documents" },
];

export function Sidebar({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100">
      {mobileOpen && (
        <button
          aria-label="Закрыть меню"
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-200 md:sticky md:top-0 md:z-10 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "md:w-[72px]" : "md:w-64"}`}
      >
        <header className={`flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-3 ${collapsed ? "md:justify-center md:px-0" : ""}`}>
          <div className={`flex min-w-0 flex-1 items-center gap-3 p-1.5 text-left ${collapsed ? "md:flex-none md:justify-center md:gap-0 md:p-0" : ""}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-700 text-white">
              <Command aria-hidden="true" className="size-5 shrink-0" />
            </span>
            <span className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}>
              <span className="block truncate text-sm font-semibold text-slate-900">ДВГМУ</span>
              <span className="block truncate text-xs text-slate-500">Личный кабинет</span>
            </span>
          </div>
          <button
            aria-label="Закрыть меню"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X className="size-4" />
          </button>
          {collapsed && (
            <button
              aria-label="Развернуть меню"
              className="absolute -right-3 top-6 z-20 hidden size-6 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 md:grid"
              onClick={() => setCollapsed(false)}
              title="Развернуть меню"
              type="button"
            >
              <PanelLeftOpen className="size-3.5 shrink-0" />
            </button>
          )}
          {!collapsed && (
            <button
              aria-label="Свернуть меню"
              className="hidden shrink-0 rounded-md p-2 text-slate-500 hover:bg-slate-100 md:inline-flex"
              onClick={() => setCollapsed(true)}
              type="button"
            >
              <PanelLeftClose className="size-4 shrink-0" />
            </button>
          )}
        </header>

        <nav aria-label="Основная навигация" className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarSection title="Платформа" collapsed={collapsed}>
            {navigation.map(({ title, icon: Icon, href }) => (
              <NavLink
                className={({ isActive }) => `group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors ${isActive ? "bg-slate-100 font-medium text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"} ${collapsed ? "md:justify-center md:gap-0 md:px-0" : ""}`}
                end
                to={href}
                key={title}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? title : undefined}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={collapsed ? "md:hidden" : ""}>{title}</span>
              </NavLink>
            ))}
          </SidebarSection>

          <SidebarSection className="mt-7" title="Рабочая область" collapsed={collapsed}>
            {workspaceItems.map(({ title, icon: Icon, href }) => (
              <NavLink
                className={({ isActive }) => `flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm transition-colors ${isActive ? "bg-slate-100 font-medium text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"} ${collapsed ? "md:justify-center md:gap-0 md:px-0" : ""}`}
                end
                to={href}
                key={title}
                title={collapsed ? `${title}: скоро` : "Раздел скоро появится"}
                onClick={() => setMobileOpen(false)}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={collapsed ? "md:hidden" : ""}>{title}</span>
                {!collapsed && <span className="ml-auto text-[10px] uppercase tracking-wide">Скоро</span>}
              </NavLink>
            ))}
          </SidebarSection>
        </nav>

        <footer className="shrink-0 border-t border-slate-100 p-3">
          <div className={`flex items-center gap-3 rounded-lg px-2 py-2 ${collapsed ? "md:justify-center md:gap-0 md:px-0" : ""}`}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
              <UserRound aria-hidden="true" className="size-4" />
            </span>
            <span className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}>
              <span className="block truncate text-sm font-medium text-slate-800">Профиль</span>
              <span className="block truncate text-xs text-slate-500">Личный кабинет</span>
            </span>
          </div>
          <div className={`mt-1 flex gap-1 ${collapsed ? "md:flex-col" : ""}`}>
            <button className={`flex h-8 flex-1 cursor-not-allowed items-center gap-2 rounded-md px-2 text-xs text-slate-400 ${collapsed ? "md:w-full md:flex-none md:justify-center md:gap-0 md:px-0" : ""}`} disabled type="button" title="Раздел скоро появится">
              <CircleHelp aria-hidden="true" className="size-4 shrink-0" />
              <span className={collapsed ? "md:hidden" : ""}>Помощь</span>
            </button>
            <button className={`flex h-8 flex-1 cursor-not-allowed items-center gap-2 rounded-md px-2 text-xs text-slate-400 ${collapsed ? "md:w-full md:flex-none md:justify-center md:gap-0 md:px-0" : ""}`} disabled type="button" title="Раздел скоро появится">
              <Settings2 aria-hidden="true" className="size-4 shrink-0" />
              <span className={collapsed ? "md:hidden" : ""}>Настройки</span>
            </button>
          </div>
        </footer>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
          <button aria-label="Открыть меню" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => setMobileOpen(true)} type="button">
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-medium text-slate-800">Личный кабинет</span>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function SidebarSection({
  children,
  className = "",
  collapsed,
  title,
}: {
  children: ReactNode;
  className?: string;
  collapsed: boolean;
  title: string;
}) {
  return (
    <section className={className}>
      <h2 className={`mb-2 px-2.5 text-xs font-medium text-slate-400 ${collapsed ? "md:sr-only md:mb-0" : ""}`}>{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}
