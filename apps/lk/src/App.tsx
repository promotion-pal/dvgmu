import { useEffect } from "react";
import { BrowserRouter } from "react-router";
import { IndexPage } from "./page";
import { Sidebar } from "@/widgets/layout/sidebar";
import { useUserProvider } from "@/features/provider/user.provider";
import { LoginPage } from "@/features/provider/login.page";
import { clearLegacyAuthStorage } from "@/features/provider/auth.session";
import { AUTH_EXPIRED_EVENT } from "@/shared/lib/connect-transport";

function App() {
  return (
    <BrowserRouter>
      <AuthenticatedApp />
    </BrowserRouter>
  );
}

function AuthenticatedApp() {
  const status = useUserProvider((state) => state.status);
  const me = useUserProvider((state) => state.me);
  const userId = useUserProvider((state) => state.userId);
  const refreshSession = useUserProvider((state) => state.refreshSession);
  const logout = useUserProvider((state) => state.logout);

  useEffect(() => {
    clearLegacyAuthStorage();
    void me();
    const expire = () => void logout();
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    const refreshTimer = window.setInterval(() => void refreshSession(), 10 * 60 * 1000);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
      window.clearInterval(refreshTimer);
    };
  }, [logout, me, refreshSession]);

  if (status === "idle" || status === "checking" || status === "loading" && userId !== null) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">Загрузка…</main>;
  }

  if (status !== "ready") return <LoginPage />;

  return (
    <Sidebar>
      <IndexPage />
    </Sidebar>
  );
}

export default App
