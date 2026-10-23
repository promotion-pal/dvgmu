import { useEffect } from "react";
import { create } from "zustand";
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { UserService } from "@dvgmu/contract/service/v1/user.service_pb";
import type { User } from "@dvgmu/contract/entity/v1/user.entity_pb";
import { UserRole } from "@dvgmu/contract/enum/v1/user.enum_pb";
import { connectTransport } from "@/shared/config/api";
import { sessionState } from "@/shared/config/session";

const userClient = createClient(UserService, connectTransport);

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
}

interface StudentProfile {
  group: string;
  faculty: string;
  course: number;
  recordBook: string;
  educationForm: string;
  status: string;
  phone: string;
  birthday: string;
  needsDormitory: boolean;
}

/** signedOut — no session: send to auth's sign-in. notLinked — signed in
 * through AD, but the account isn't linked to MDM, so there are no roles. */
type UserStatus = "idle" | "loading" | "ready" | "signedOut" | "notLinked" | "unknown";

interface UseUserProvider {
  status: UserStatus;
  user: User | null;
  profile: UserProfile | null;
  userId: bigint;
  student: StudentProfile | null;
  load: (force?: boolean) => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  /** Право на действие (или роль ADMIN — у неё все права). */
  hasPermission: (...permissions: string[]) => boolean;
}

export const useUserProvider = create<UseUserProvider>((set, get) => ({
  status: "idle",
  user: null,
  profile: null,
  userId: 0n,
  student: null,

  load: async (force = false) => {
    const { status } = get();
    if (!force && status !== "idle") return;

    set({ status: "loading" });
    try {
      const response = await userClient.userMe({});
      set({
        status: "ready",
        user: response.user ?? null,
        profile: {
          firstName: response.firstName,
          lastName: response.lastName,
          email: response.email,
          username: response.username,
        },
        userId: response.user?.mdmId ?? 0n,
      });
    } catch (error) {
      // The transport has already tried a refresh; ask auth why there is no session.
      let status: UserStatus = "unknown";
      if (ConnectError.from(error).code === Code.Unauthenticated) {
        const state = await sessionState();
        if (state === "notLinked") status = "notLinked";
        else if (state === "signedOut" || state === "expired") status = "signedOut";
      }
      set({ status, user: null, profile: null, userId: 0n });
    }
  },

  hasRole: (...roles) =>
    Boolean(get().user?.roles.some((role) => role === UserRole.ADMIN || roles.includes(role))),

  hasPermission: (...permissions) => {
    const user = get().user;
    if (!user) return false;
    return user.roles.includes(UserRole.ADMIN) || user.permissions.some((p) => permissions.includes(p));
  },
}));

export const useLoadUser = () => {
  const provider = useUserProvider();
  useEffect(() => {
    provider.load();
  }, []);
  return provider;
};

export type { UserProfile, StudentProfile, UserStatus };
