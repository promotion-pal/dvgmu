import { createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { UserService } from "@fesmu/contract/mdm/service/user.service_pb";
import type { User } from "@fesmu/contract/mdm/entity/user.entity_pb";
import { create } from "zustand";
import { ENV } from "@/shared/config/env";

const userClient = createClient(
  UserService,
  createGrpcWebTransport({ baseUrl: ENV.MDM }),
);

export const DEFAULT_USER_ID = 1n;
type UserStatus = "idle" | "loading" | "ready" | "unauthenticated" | "error";

interface UserProviderState {
  status: UserStatus;
  user: User | null;
  userId: bigint;
  error: Error | null;
  me: () => Promise<void>;
  fetchById: (id: bigint) => Promise<User>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
}

export const useUserProvider = create<UserProviderState>((set, get) => ({
  status: "idle",
  user: null,
  userId: DEFAULT_USER_ID,
  error: null,

  me: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    try {
      await get().fetchById(DEFAULT_USER_ID);
    } catch {}
  },

  fetchById: async (id) => {
    set({ status: "loading", userId: id, error: null });
    try {
      const response = await userClient.userFetchByID({ id });
      if (!response.user) throw new Error("MDM не вернул пользователя");
      set({ status: "ready", user: response.user, userId: id });
      return response.user;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Не удалось получить пользователя");
      set({ status: "error", user: null, userId: id, error });
      throw error;
    }
  },

  login: async (_email, _password) => {
    set({ status: "unauthenticated", user: null, error: null });
  },

  logout: async () => {
    set({ status: "unauthenticated", user: null, error: null });
  },

  reset: () => set({ status: "idle", user: null, userId: DEFAULT_USER_ID, error: null }),
}));

export type { User, UserStatus };
