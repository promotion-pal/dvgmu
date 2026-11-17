export const ENV = {
  API: import.meta.env.VITE_API_URL ?? "http://localhost:4050",
  MDM: import.meta.env.VITE_MDM_API_URL ?? "http://localhost:4051",
  AUTH: import.meta.env.VITE_AUTH_URL ?? "https://auth.fesmu.ru",
};
