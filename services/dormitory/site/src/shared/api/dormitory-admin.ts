import { createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { ADMIN_PASSWORD } from "@/shared/config/admin";
import { ENV } from "@/shared/config/env";
import { DormitoryService } from "@fesmu/contract/dormitory/service/dormitory.service_pb";

const withAdminAuth: Interceptor = (next) => (req) => {
  req.header.set("Authorization", `Bearer ${ADMIN_PASSWORD}`);
  return next(req);
};

const adminTransport = createConnectTransport({
  baseUrl: ENV.API,
  interceptors: [withAdminAuth],
  fetch: (url, options) =>
    globalThis.fetch(url, { ...options, credentials: "include" }),
});

export const dormitoryAdminClient = createClient(DormitoryService, adminTransport);
