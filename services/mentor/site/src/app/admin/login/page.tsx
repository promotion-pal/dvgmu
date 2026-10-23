"use client";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ADMIN_CREDENTIALS } from "@/shared/config/admin";
import { isAdminAuthenticated, setAdminAuthenticated } from "@/shared/lib/admin-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdminAuthenticated()) {
      router.replace("/admin");
    }
  }, [router]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      login === ADMIN_CREDENTIALS.login &&
      password === ADMIN_CREDENTIALS.password
    ) {
      setAdminAuthenticated();
      router.replace("/admin");
    } else {
      setError("Неверный логин или пароль");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f0] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-gray-100 p-8 space-y-4"
      >
        <h1 className="font-serif text-xl text-[#1a1a2e] text-center mb-2">
          Вход в админ-панель
        </h1>

        <div className="space-y-1.5">
          <Label htmlFor="login">Логин</Label>
          <Input
            id="login"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button type="submit" className="w-full">
          Войти
        </Button>
      </form>
    </div>
  );
}
