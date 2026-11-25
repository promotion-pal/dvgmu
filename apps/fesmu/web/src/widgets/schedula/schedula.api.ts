import { createClient } from "@connectrpc/connect";
import { SchedulaService } from "@fesmu/contract/schedula/service/schedula.service_pb";
import { connectTransport } from "@/shared/config/api";

export const schedulaClient = createClient(SchedulaService, connectTransport);
