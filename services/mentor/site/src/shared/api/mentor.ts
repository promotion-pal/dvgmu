import { createClient } from "@connectrpc/connect";
import { MentorService } from "@fesmu/contract/mentor/service/mentor.service_pb";
import { connectTransport } from "@/shared/config/api";

export const mentorServiceClient = createClient(MentorService, connectTransport);
