import { createClient } from "@connectrpc/connect";
import { UserService } from "@proto/service/user.service_pb";
import { connectTransport } from "@/shared/config/api";

export const userServiceClient = createClient(UserService, connectTransport);
