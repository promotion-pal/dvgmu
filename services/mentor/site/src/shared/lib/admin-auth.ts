"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_SESSION_KEY } from "@/shared/config/admin";

export function isAdminAuthenticated() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ADMIN_SESSION_KEY) === "1";
}

export function setAdminAuthenticated() {
  window.localStorage.setItem(ADMIN_SESSION_KEY, "1");
}

export function clearAdminAuthenticated() {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function useRequireAdminAuth() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
  }, [router]);

  return ready;
}
