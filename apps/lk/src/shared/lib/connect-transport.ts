import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";

export const AUTH_EXPIRED_EVENT = "dvgmu:auth-expired";

const sessionInterceptor: Interceptor = (next) => async (request) => {
  try {
    return await next(request);
  } catch (error) {
    if (error instanceof ConnectError && error.code === Code.Unauthenticated && typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    throw error;
  }
};

export function createAuthenticatedTransport(baseUrl: string) {
  return createGrpcWebTransport({
    baseUrl,
    interceptors: [sessionInterceptor],
    fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
  });
}
