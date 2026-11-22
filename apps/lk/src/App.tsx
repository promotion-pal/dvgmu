import { useEffect } from "react";
import { BrowserRouter } from "react-router";
import { IndexPage } from "./page";
import { Sidebar } from "@/widgets/layout/sidebar";
import { useUserProvider } from "@/features/provider/user.provider";
import { LoginPage } from "@/features/provider/login.page";
import { getAccessToken } from "@/features/provider/auth.session";

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

  useEffect(() => {
    void me();
  }, [me]);

  if (status === "idle" || status === "loading" && getAccessToken()) {
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
