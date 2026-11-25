const gateway = import.meta.env.VITE_GATEWAY_URL || (import.meta.env.DEV ? "http://localhost:4052" : window.location.origin);

export const ENV = {
  GATEWAY: gateway,
  API: `${gateway}/api/tickets`,
  MDM: `${gateway}/api/mdm`,
  AUTH: `${gateway}/api/auth`,
};
