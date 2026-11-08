import { useEffect, useState } from "react";
import { PlusIcon } from "lucide-react";
import type { UserPermissionGroup } from "@fesmu/contract/mdm/entity/user.entity_pb";
import { CommonWrapper } from "@/shared/components/wrapper";
import { Button } from "@/shared/ui/button";
import {
    UserPermissionGroupDialog,
    UserPermissionGroupList,
    DeleteUserPermissionGroupDialog,
    emptyDraft,
    toDraft,
    useUserPermissionGroups,
} from "@/widgets/user-permission-group-admin";
import type { UserPermissionGroupDraft } from "@/widgets/user-permission-group-admin";

export function PermissionGroupAdmin() {
    const { groups, fetch, save, remove } = useUserPermissionGroups();
    const [editing, setEditing] = useState<UserPermissionGroupDraft | null>(null);
    const [deleting, setDeleting] = useState<UserPermissionGroup | null>(null);

    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CommonWrapper
            title="Группы прав по функциям"
            description="Создайте наборы разрешений для отдельных разделов и действий. Назначить группу пользователю можно на вкладке «Роли и подразделения»."
            action={
                <Button onClick={() => setEditing(emptyDraft())}>
                    <PlusIcon className="size-4" />
                    Новая группа прав
                </Button>
            }
        >
            <>
                <UserPermissionGroupList
                    list={groups.list}
                    onEdit={(group) => setEditing(toDraft(group))}
                    onDelete={setDeleting}
                    isLoading={groups.loading}
                    isError={groups.error}
                    isEmpty={groups.list.length === 0}
                />
                <UserPermissionGroupDialog draft={editing} onClose={() => setEditing(null)} onSave={save} />
                <DeleteUserPermissionGroupDialog group={deleting} onClose={() => setDeleting(null)} onConfirm={remove} />
            </>
        </CommonWrapper>
    );
}
