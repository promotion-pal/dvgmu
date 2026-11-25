import { Outlet } from "react-router-dom";
import { Footer } from "./footer";
import { Header, HeaderProvider } from "./header";
import { AppSidebar } from "./sidebar";
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar";
import type { FC } from "react";

interface LayoutProps {
  notViewHeader?: boolean;
  notViewFooter?: boolean;
  notViewSidebar?: boolean;
}
export const Layout: FC<LayoutProps> = ({
  notViewHeader = false,
  notViewFooter = false,
  notViewSidebar = false,
}) => {
  const content = (
    <HeaderProvider>
      <div className="flex flex-col min-h-screen bg-background w-full">
        {!notViewHeader && <Header />}

        <main className="flex-1 min-w-0 flex items-stretch justify-center">
          <Outlet />
        </main>

        {!notViewFooter && <Footer />}
      </div>
    </HeaderProvider>
  );

  if (notViewSidebar) {
    return content;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">{content}</SidebarInset>
    </SidebarProvider>
  );
};
