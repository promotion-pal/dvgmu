"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useState,
  useSyncExternalStore,
} from "react";

import { ADMIN_PASSWORD, ADMIN_SESSION_KEY } from "@/shared/config/admin";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

const listeners = new Set<() => void>();

const authStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get() {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  },
  set(ok: boolean) {
    try {
      if (ok) sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      else sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      /* sessionStorage может быть недоступен */
    }
    listeners.forEach((l) => l());
  },
};

const AdminGate = ({ children }: { children: ReactNode }) => {
  const ok = useSyncExternalStore(
    authStore.subscribe,
    authStore.get,
    () => false,
  );

  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (value === ADMIN_PASSWORD) {
        authStore.set(true);
        setError(false);
      } else {
        setError(true);
      }
    },
    [value],
  );

  if (ok) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-muted-foreground"
          onClick={() => {
            authStore.set(false);
            setValue("");
          }}
        >
          Выйти
        </Button>
        {children}
      </>
    );
  }

  return (
    <Card className="max-w-xs gap-4 p-6">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="admin-password" className="text-sm font-medium">
          Пароль администратора
        </label>
        <Input
          id="admin-password"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
        />
        {error && (
          <span className="text-sm text-destructive">Неверный пароль</span>
        )}
        <Button type="submit">Войти</Button>
      </form>
    </Card>
  );
};

export { AdminGate };
