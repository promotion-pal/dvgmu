declare const __APP_VERSION__: string;

const gateway = __APP_VERSION__ === "prod" ? window.location.origin : "http://localhost:4052";

export const ENV = {
  GATEWAY: gateway,
  API: `${gateway}/api/tickets`,
  MDM: `${gateway}/api/mdm`,
  AUTH: `${gateway}/api/auth`,
};
