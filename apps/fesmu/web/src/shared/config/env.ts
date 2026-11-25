export const ENV = {
  API: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  AUTH: import.meta.env.VITE_AUTH_URL ?? "https://auth.fesmu.ru",
  LOCAL_TASKS: import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_TASKS === "true",
};
