import { Code, ConnectError } from "@connectrpc/connect";
import type { Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ENV } from "./env";
import { refreshSession } from "./session";

const fetchWithCredentials: typeof fetch = (url, options) =>
  globalThis.fetch(url, { ...options, credentials: "include" });

// The access token lives 15 minutes: on Unauthenticated, refresh it once
// through auth and repeat the call. A failed refresh lets the error through —
// the user gate then sends the visitor to sign in.
const refreshOnUnauthenticated: Interceptor = (next) => async (req) => {
  try {
    return await next(req);
  } catch (error) {
    if (ConnectError.from(error).code !== Code.Unauthenticated || !(await refreshSession())) throw error;
    return next(req);
  }
};

export const connectTransport = createConnectTransport({
  baseUrl: ENV.API,
  fetch: fetchWithCredentials,
  interceptors: [refreshOnUnauthenticated],
});
