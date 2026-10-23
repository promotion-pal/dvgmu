import { PromFieldInput, PromDateField, PromFieldSelect } from "@/features/lib/form";
import type { FC } from "react";
import { useEffect } from "react";
import { FormProvider } from "react-hook-form";
import { formatUserFullName, useUser } from "./user.fn";
import type { useUserForm } from "./user.fn";
import type { UserSchema } from "./user.schema";

type UserFormProps = ReturnType<typeof useUserForm>;
const UserForm: FC<UserFormProps> = ({ form, handleSubmit, isEditing }) => {
    type FormData = UserSchema;
    const FieldInput = PromFieldInput<FormData>;
    const DateField = PromDateField<FormData>;

    return (
        <FormProvider {...form}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                    <FieldInput name="lastName" label="Фамилия" placeholder="Иванов" />
                    <FieldInput name="firstName" label="Имя" placeholder="Иван" />
                </div>

                <FieldInput name="patronymic" label="Отчество" placeholder="Иванович" />

                <div className="grid grid-cols-2 gap-4">
                    <FieldInput name="email" label="Email" placeholder="ivanov@fesmu.ru" />
                    <FieldInput name="phone" label="Телефон" placeholder="+7 900 000-00-00" />
                </div>

                <DateField name="birthday" label="Дата рождения" required={false} />

                <button
                    type="submit"
                    className="ml-auto w-fit bg-primary text-primary-foreground py-2 px-6 rounded-lg hover:opacity-90 transition-opacity"
                >
                    {isEditing ? "Сохранить изменения" : "Добавить пользователя"}
                </button>
            </form>
        </FormProvider>
    );
};

export { UserForm };

interface UserFieldSelectProps {
    name?: string;
    label?: string;
}
/** Existing-user picker reused by widgets that attach a role (Student,
 * Employee) to an already-created base user by id. */
const UserFieldSelect: FC<UserFieldSelectProps> = ({ name = "userId", label = "Пользователь" }) => {
    const { fetch, list } = useUser();

    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <PromFieldSelect
            name={name}
            label={label}
            placeholder="Выберите пользователя"
            options={list.map((item) => ({
                label: formatUserFullName(item),
                value: item.id.toString(),
            }))}
        />
    );
};

export { UserFieldSelect };
