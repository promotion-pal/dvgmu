import { createClient } from "@connectrpc/connect";
import { UserService } from "@fesmu/contract/mdm/service/user.service_pb";
import type { User } from "@fesmu/contract/mdm/entity/user.entity_pb";
import { UserPermission } from "@fesmu/contract/mdm/enum/user.enum_pb";
import { create } from "zustand";
import { ENV } from "@/shared/config/env";
import { createAuthenticatedTransport } from "@/shared/lib/connect-transport";
import { clearLegacyAuthStorage } from "./auth.session";

const userClient = createClient(
  UserService,
  createAuthenticatedTransport(ENV.MDM),
);

type UserStatus = "idle" | "checking" | "loading" | "ready" | "unauthenticated" | "error";

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
  refreshSession: () => Promise<void>;
  expireSession: () => void;
  reset: () => void;
}

export const useUserProvider = create<UserProviderState>((set, get) => ({
  status: "idle",
  user: null,
  availableUsers: [],
  userId: null,
  error: null,

  me: async () => {
    if (["checking", "loading", "ready"].includes(get().status)) return;
    clearLegacyAuthStorage();
    set({ status: "checking", user: null, userId: null, error: null });
    try {
      const response = await fetch(`${ENV.AUTH}/v1/auth/session`, { credentials: "include" });
      if (response.status === 401) {
        set({ status: "unauthenticated", user: null, userId: null, error: null });
        return;
      }
      if (!response.ok) throw new Error((await response.text()) || "Не удалось проверить сессию");
      const payload = (await response.json()) as { user_id?: string };
      if (!payload.user_id || !/^\d+$/.test(payload.user_id)) throw new Error("Auth вернул некорректный ID пользователя");
      await get().fetchById(BigInt(payload.user_id));
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Не удалось проверить сессию");
      set({ status: "error", user: null, userId: null, error });
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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Не удалось войти");
      }
      const payload = (await response.json()) as { user_id?: string };
      if (!payload.user_id || !/^\d+$/.test(payload.user_id)) {
        throw new Error("Auth вернул некорректный ответ");
      }
      clearLegacyAuthStorage();
      await get().fetchById(BigInt(payload.user_id));
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Не удалось войти");
      set({ status: "unauthenticated", user: null, userId: null, error });
      throw error;
    }
  },

  logout: async () => {
    try {
      await fetch(`${ENV.AUTH}/v1/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
    } finally {
      clearLegacyAuthStorage();
      set({ status: "unauthenticated", user: null, userId: null, error: null });
    }
  },

  refreshSession: async () => {
    if (get().status !== "ready") return;
    try {
      const response = await fetch(`${ENV.AUTH}/v1/auth/session`, { credentials: "include" });
      if (response.status === 401) {
        get().expireSession();
        return;
      }
      if (!response.ok) throw new Error((await response.text()) || "Не удалось обновить сессию");
      const payload = (await response.json()) as { user_id?: string };
      if (!payload.user_id || !/^\d+$/.test(payload.user_id)) throw new Error("Auth вернул некорректный ID пользователя");
      const currentID = get().userId;
      const refreshedID = BigInt(payload.user_id);
      const profile = await userClient.userFetchByID({ id: refreshedID });
      if (!profile.user) throw new Error("MDM не вернул пользователя");
      set({ status: "ready", user: profile.user, userId: refreshedID, error: null });
      if (currentID !== refreshedID) set({ availableUsers: [] });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause : new Error("Не удалось обновить сессию") });
    }
  },

  expireSession: () => {
    clearLegacyAuthStorage();
    set({ status: "unauthenticated", user: null, userId: null, error: null });
  },

  reset: () => {
    clearLegacyAuthStorage();
    set({ status: "idle", user: null, userId: null, error: null });
  },
}));

export type { User, UserStatus };

export function userHasPermission(user: User | null, permission: UserPermission): boolean {
  return user?.permission?.permissions.includes(permission) ?? false;
}
