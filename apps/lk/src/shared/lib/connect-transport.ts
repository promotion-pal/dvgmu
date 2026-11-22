import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { clearAuthSession, getAccessToken } from "@/features/provider/auth.session";

const authInterceptor: Interceptor = (next) => async (request) => {
  const accessToken = getAccessToken();
  if (accessToken) request.header.set("Authorization", `Bearer ${accessToken}`);

  try {
    return await next(request);
  } catch (error) {
    if (error instanceof ConnectError && error.code === Code.Unauthenticated) {
      clearAuthSession();
    }
    throw error;
  }
};

export function createAuthenticatedTransport(baseUrl: string) {
  return createGrpcWebTransport({ baseUrl, interceptors: [authInterceptor] });
}
