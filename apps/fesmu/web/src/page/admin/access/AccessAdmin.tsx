import { useEffect, useState } from "react";
import { PlusIcon } from "lucide-react";
import type { AccessGroup } from "@dvgmu/contract/mdm/entity/user.entity_pb";
import { CommonWrapper } from "@/shared/components/wrapper";
import { Button } from "@/shared/ui/button";
import {
    AccessGroupDialog,
    AccessGroupList,
    DeleteAccessGroupDialog,
    emptyDraft,
    toDraft,
    useAccessGroups,
} from "@/widgets/access-admin";
import type { AccessGroupDraft } from "@/widgets/access-admin";

export function AccessAdmin() {
    const { groups, fetch, save, remove } = useAccessGroups();
    const [editing, setEditing] = useState<AccessGroupDraft | null>(null);
    const [deleting, setDeleting] = useState<AccessGroup | null>(null);

    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CommonWrapper
            title="Доступы"
            description="Доступ — «сотрудник отдела»: какие разделы и действия ему открыты. Выдаётся людям на странице «Роли»; у человека открыто всё из всех его доступов"
            action={
                <Button onClick={() => setEditing(emptyDraft())}>
                    <PlusIcon className="size-4" />
                    Новый доступ
                </Button>
            }
        >
            <>
                <AccessGroupList
                    list={groups.list}
                    onEdit={(group) => setEditing(toDraft(group))}
                    onDelete={setDeleting}
                    isLoading={groups.loading}
                    isError={groups.error}
                    isEmpty={groups.list.length === 0}
                />
                <AccessGroupDialog draft={editing} onClose={() => setEditing(null)} onSave={save} />
                <DeleteAccessGroupDialog group={deleting} onClose={() => setDeleting(null)} onConfirm={remove} />
            </>
        </CommonWrapper>
    );
}
