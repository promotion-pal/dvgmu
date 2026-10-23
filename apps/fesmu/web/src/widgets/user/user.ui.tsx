import type { ComponentProps, FC } from "react";
import { UserIcon, MailIcon, PhoneIcon, CalendarIcon, KeyIcon } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import type { User } from "@dvgmu/mdm/entity/user.entity_pb";
import { PersonDetails, PersonSummary } from "@/shared/components/person";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonModal } from "@/shared/components/modal";
import { DEFAULT_USER_PASSWORD, formatUserFullName, USER_STATUS_LABEL } from "./user.fn";
import type { useUser } from "./user.fn";
import { UserForm } from "./user.form";

interface UserCreateModalProps {
    formProps: ComponentProps<typeof UserForm>;
}
const UserCreateModal: FC<UserCreateModalProps> = ({ formProps }) => {
    return <UserForm {...formProps} />;
};

export { UserCreateModal };

interface UserListProps extends ComponentProps<typeof CommonControlState> {
    list: User[];
    userModal: ReturnType<typeof useUser>["userModal"];
    activeMenu?: ReturnType<typeof useUser>["activeMenu"];
    selectedIds?: ReturnType<typeof useUser>["selectedIds"];
    toggleSelected?: ReturnType<typeof useUser>["toggleSelected"];
}
const UserList: FC<UserListProps> = ({ list, userModal, activeMenu, selectedIds, toggleSelected, ...state }) => {
    return (
        <>
            <CommonControlState {...state}>
                <section className="grid md:grid-cols-3 gap-4">
                    {list.map((item) => (
                        <UserListItem
                            item={item}
                            key={item.id.toString()}
                            activeMenu={activeMenu}
                            selected={selectedIds?.has(item.id)}
                            onToggleSelect={toggleSelected ? () => toggleSelected(item.id) : undefined}
                        />
                    ))}
                </section>
            </CommonControlState>

            <CommonModal
                {...userModal}
                title={userModal.modalConfig[userModal.type].title}
                description={userModal.modalConfig[userModal.type].description}
            >
                {userModal.modalConfig[userModal.type].component}
            </CommonModal>
        </>
    );
};

interface UserListItemProps {
    item: User;
    activeMenu?: ReturnType<typeof useUser>["activeMenu"];
    selected?: boolean;
    onToggleSelect?: () => void;
}
const UserListItem: FC<UserListItemProps> = ({ item, activeMenu, selected, onToggleSelect }) => {
    return (
        <PersonSummary
            fullName={formatUserFullName(item)}
            email={item.email}
            phone={item.phone}
            badges={<Badge variant="secondary">{USER_STATUS_LABEL[item.status]}</Badge>}
            menuItems={activeMenu?.(item.id)}
            selected={selected}
            onToggleSelect={onToggleSelect}
        />
    );
};

export { UserList };

interface UserDetailsProps {
    item?: User;
}
const UserDetails: FC<UserDetailsProps> = ({ item }) => {
    if (!item) return null;

    return (
        <PersonDetails
            badges={<Badge variant="secondary">{USER_STATUS_LABEL[item.status]}</Badge>}
            rows={[
                { icon: <UserIcon className="size-4" />, label: "ФИО", value: formatUserFullName(item) },
                { icon: <MailIcon className="size-4" />, label: "Логин (email)", value: item.email || "—" },
                { icon: <PhoneIcon className="size-4" />, label: "Телефон", value: item.phone || "—" },
                {
                    icon: <CalendarIcon className="size-4" />,
                    label: "Дата рождения",
                    value: item.birthday ? new Date(Number(item.birthday.seconds) * 1000).toLocaleDateString("ru-RU") : "—",
                },
                { icon: <KeyIcon className="size-4" />, label: "Пароль", value: DEFAULT_USER_PASSWORD },
            ]}
        />
    );
};

export { UserDetails };
