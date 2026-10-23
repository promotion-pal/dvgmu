import { useFetchState } from "@/features/lib/fetch";
import type { AccessGroup } from "@fesmu/contract/entity/user.entity_pb";
import type { UserEmployeeDepartment } from "@fesmu/contract/enum/user.enum_pb";
import { UserService } from "@fesmu/contract/service/user.service_pb";
import { connectTransport } from "@/shared/config/api";
import { ConnectError, createClient } from "@connectrpc/connect";
import { toast } from "sonner";
import type { PermissionSection } from "@/shared/config/permissions";
import { PermissionAction, perm } from "@/shared/config/permissions";

const userClient = createClient(UserService, connectTransport);

/** Галочка «Просмотр»/«Изменение» раздела: изменение включает просмотр,
 *  снятый просмотр снимает и изменение. */
const toggleSectionAction = (codes: string[], section: PermissionSection, action: PermissionAction, on: boolean) => {
    const fetch = perm(section, PermissionAction.FETCH);
    const post = perm(section, PermissionAction.POST);
    const next = new Set(codes);
    if (on) {
        next.add(fetch);
        if (action === PermissionAction.POST) next.add(post);
    } else {
        next.delete(post);
        if (action === PermissionAction.FETCH) next.delete(fetch);
    }
    return [...next].sort();
};

/** Переключатель группы: включить — открыть все её разделы на просмотр,
 *  выключить — снять с них всё. */
const toggleSections = (codes: string[], sections: PermissionSection[], on: boolean) => {
    const next = new Set(codes);
    for (const section of sections) {
        if (on) next.add(perm(section, PermissionAction.FETCH));
        else {
            next.delete(perm(section, PermissionAction.FETCH));
            next.delete(perm(section, PermissionAction.POST));
        }
    }
    return [...next].sort();
};

/** Черновик набора в окне правки; id 0 — новый. */
interface AccessGroupDraft {
    id: bigint;
    name: string;
    description: string;
    permissions: string[];
    /** Подразделения, всем сотрудникам которых доступ выдаётся сам. */
    departments: UserEmployeeDepartment[];
}

const emptyDraft = (): AccessGroupDraft => ({ id: 0n, name: "", description: "", permissions: [], departments: [] });

const toDraft = (g: AccessGroup): AccessGroupDraft => ({
    id: g.id,
    name: g.name,
    description: g.description,
    permissions: [...g.permissions],
    departments: [...g.departments],
});

const useAccessGroups = () => {
    const state = useFetchState<AccessGroup>();

    const fetch = async () => {
        state.setLoading(true);
        state.setError(false);
        try {
            const response = await userClient.accessGroupFetch({});
            state.setList(response.groups);
        } catch (error) {
            console.error("Ошибка при получении наборов доступа:", error);
            state.setError(true);
        } finally {
            state.setLoading(false);
        }
    };

    /** true — сохранено (окно можно закрыть). */
    const save = async (draft: AccessGroupDraft): Promise<boolean> => {
        try {
            const response = await userClient.accessGroupSave(draft);
            const saved = response.group;
            if (saved) {
                state.setList((list) =>
                    draft.id === 0n
                        ? [...list, saved].sort((a, b) => a.name.localeCompare(b.name, "ru"))
                        : list.map((g) => (g.id === saved.id ? saved : g)),
                );
            }
            toast.success(`Доступ «${draft.name.trim()}» сохранён`);
            return true;
        } catch (error) {
            console.error("Ошибка при сохранении набора:", error);
            toast.error(`Не удалось сохранить: ${ConnectError.from(error).rawMessage}`);
            return false;
        }
    };

    const remove = async (group: AccessGroup) => {
        try {
            await userClient.accessGroupDelete({ id: group.id });
            state.setList((list) => list.filter((g) => g.id !== group.id));
            toast.success(`Доступ «${group.name}» удалён`);
        } catch (error) {
            console.error("Ошибка при удалении набора:", error);
            toast.error(`Не удалось удалить: ${ConnectError.from(error).rawMessage}`);
        }
    };

    return { groups: state, fetch, save, remove };
};

export { emptyDraft, toDraft, toggleSectionAction, toggleSections, useAccessGroups };
export type { AccessGroupDraft };
