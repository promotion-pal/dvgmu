import { ENV } from "./env";

/* The session lives in auth (auth.fesmu.ru): two HttpOnly cookies the page
 * never reads — a 15-minute access token the api checks, and a refresh token
 * only auth sees. Everything here is a plain fetch with credentials. */

/** Why auth's /me says there is no fesmu session. */
type SessionState = "active" | "expired" | "notLinked" | "signedOut" | "unavailable";

const call = (path: string, method: "GET" | "POST") =>
  fetch(`${ENV.AUTH}${path}`, { method, credentials: "include" });

const sessionState = async (): Promise<SessionState> => {
  try {
    const response = await call("/api/v1/auth/me", "GET");
    if (response.ok) return "active";
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 403 && body.error === "not_linked") return "notLinked";
    if (response.status === 401 && body.error === "expired") return "expired";
    if (response.status === 401) return "signedOut";
    return "unavailable";
  } catch {
    return "unavailable";
  }
};

// Parallel 401s share one refresh: auth rotates the token on every refresh,
// so a second concurrent one would present an already used token.
let refreshing: Promise<boolean> | null = null;

const refreshSession = (): Promise<boolean> => {
  refreshing ??= call("/api/v1/auth/refresh", "POST")
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

/** auth's sign-in form; it returns here (or straight away if the AD session is alive). */
const signIn = (returnTo = window.location.href) => {
  window.location.assign(`${ENV.AUTH}/login?return=${encodeURIComponent(returnTo)}`);
};

const signOut = async () => {
  await call("/api/v1/auth/logout", "POST").catch(() => undefined);
  signIn(window.location.origin + "/");
};

export { refreshSession, sessionState, signIn, signOut };
export type { SessionState };
