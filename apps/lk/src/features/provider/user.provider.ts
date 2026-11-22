import { createClient } from "@connectrpc/connect";
import { UserService } from "@fesmu/contract/mdm/service/user.service_pb";
import type { User } from "@fesmu/contract/mdm/entity/user.entity_pb";
import { UserPermission } from "@fesmu/contract/mdm/enum/user.enum_pb";
import { create } from "zustand";
import { ENV } from "@/shared/config/env";
import { createAuthenticatedTransport } from "@/shared/lib/connect-transport";
import { clearAuthSession, getAccessToken, getAuthenticatedUserId, setAuthSession } from "./auth.session";

const userClient = createClient(
  UserService,
  createAuthenticatedTransport(ENV.MDM),
);

type UserStatus = "idle" | "loading" | "ready" | "unauthenticated" | "error";

interface UserProviderState {
  status: UserStatus;
  user: User | null;
  availableUsers: User[];
  userId: bigint | null;
  error: Error | null;
  me: () => Promise<void>;
  fetchById: (id: bigint) => Promise<User>;
  fetchUsers: () => Promise<User[]>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
}

export const useUserProvider = create<UserProviderState>((set, get) => ({
  status: "idle",
  user: null,
  availableUsers: [],
  userId: null,
  error: null,

  me: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    const userId = getAuthenticatedUserId();
    if (!getAccessToken() || userId === null) {
      clearAuthSession();
      set({ status: "unauthenticated", user: null, userId: null, error: null });
      return;
    }
    try {
      await get().fetchById(userId);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Не удалось проверить сессию");
      set({ status: "error", user: null, userId, error });
    }
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

  fetchUsers: async () => {
    const response = await userClient.userFetch({});
    set({ availableUsers: response.users });
    return response.users;
  },

  login: async (email, password) => {
    set({ status: "loading", error: null });
    try {
      const response = await fetch(`${ENV.AUTH}/v1/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Не удалось войти");
      }
      const payload = (await response.json()) as { access_token?: string; user_id?: string };
      if (!payload.access_token || !payload.user_id || !/^\d+$/.test(payload.user_id)) {
        throw new Error("Auth вернул некорректный ответ");
      }
      const userId = BigInt(payload.user_id);
      setAuthSession(payload.access_token, userId);
      await get().fetchById(userId);
    } catch (cause) {
      clearAuthSession();
      const error = cause instanceof Error ? cause : new Error("Не удалось войти");
      set({ status: "unauthenticated", user: null, userId: null, error });
      throw error;
    }
  },

  logout: async () => {
    clearAuthSession();
    set({ status: "unauthenticated", user: null, userId: null, error: null });
  },

  reset: () => {
    clearAuthSession();
    set({ status: "idle", user: null, userId: null, error: null });
  },
}));

export type { User, UserStatus };

export function userHasPermission(user: User | null, permission: UserPermission): boolean {
  return user?.permission?.permissions.includes(permission) ?? false;
}
