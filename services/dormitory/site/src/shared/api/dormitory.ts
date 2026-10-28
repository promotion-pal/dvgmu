import { createClient } from "@connectrpc/connect";
import { DormitoryService } from "@fesmu/contract/dormitory/service/dormitory.service_pb";
import { connectTransport } from "@/shared/config/api";

export const dormitoryServiceClient = createClient(DormitoryService, connectTransport);
