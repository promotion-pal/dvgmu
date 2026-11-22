const TOKEN_KEY = "dvgmu.access-token";
const USER_ID_KEY = "dvgmu.user-id";

function storage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function getAccessToken(): string | null {
  return storage()?.getItem(TOKEN_KEY) ?? null;
}

export function getAuthenticatedUserId(): bigint | null {
  const value = storage()?.getItem(USER_ID_KEY);
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

export function setAuthSession(accessToken: string, userId: bigint): void {
  storage()?.setItem(TOKEN_KEY, accessToken);
  storage()?.setItem(USER_ID_KEY, userId.toString());
}

export function clearAuthSession(): void {
  storage()?.removeItem(TOKEN_KEY);
  storage()?.removeItem(USER_ID_KEY);
}
