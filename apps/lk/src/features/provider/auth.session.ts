export function clearLegacyAuthStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem("dvgmu.access-token");
    window.sessionStorage.removeItem("dvgmu.user-id");
  } catch {}
}
