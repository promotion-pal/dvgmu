import { createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { TaskService } from "@fesmu/contract/tickets/service/ticket.service_pb";
import { ENV } from "@/shared/config/env";

export type TaskItem = {
  id: string;
  title: string;
  createdAt: string;
};

const client = createClient(
  TaskService,
  createGrpcWebTransport({ baseUrl: ENV.API }),
);

export async function listTasks(): Promise<TaskItem[]> {
  const response = await client.listTasks({});
  return response.tasks.map((task) => ({
    id: task.id.toString(),
    title: task.title,
    createdAt: task.createdAt.toString(),
  }));
}

export async function createTask(title: string): Promise<TaskItem> {
  const response = await client.createTask({ title });
  if (!response.task) throw new Error("Сервис не вернул созданную задачу");
  return {
    id: response.task.id.toString(),
    title: response.task.title,
    createdAt: response.task.createdAt.toString(),
  };
}
