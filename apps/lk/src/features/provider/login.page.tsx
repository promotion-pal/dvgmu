import { useState, type FormEvent } from "react";
import { useUserProvider } from "@/features/provider/user.provider";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/ui/card";

export function LoginPage() {
  const login = useUserProvider((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <Card className="w-full max-w-md" size="lg">
        <CardHeader>
          <h1 className="text-2xl font-semibold text-slate-900">Вход в личный кабинет</h1>
          <CardDescription>Используй учетную запись, настроенную для Auth.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Электронная почта
              <input
                autoComplete="username"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Пароль
              <input
                autoComplete="current-password"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Вход…" : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
