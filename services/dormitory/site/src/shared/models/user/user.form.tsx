import { FormProvider } from "react-hook-form";

import { PromFieldInput } from "@/features/lib/form";

import { useUserForm } from "./user.fn";
import { UserCreateSchema } from "./user.schema";

type UserFormProps = ReturnType<typeof useUserForm>;

const UserForm = ({ form, handleSubmit }: UserFormProps) => {
  const FieldInput = PromFieldInput<UserCreateSchema>;

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <FieldInput
          name="lastName"
          label="Фамилия"
          placeholder="Иванов"
        />

        <FieldInput
          name="firstName"
          label="Имя"
          placeholder="Иван"
        />

        <FieldInput
          name="patronymic"
          label="Отчество"
          placeholder="Иванович"
        />

        <FieldInput
          name="phone"
          type="tel"
          label="Телефон"
          placeholder="+7 (900) 000-00-00"
        />

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="border rounded-lg p-2 bg-black text-white font-medium disabled:opacity-50"
        >
          Создать пользователя
        </button>
      </form>
    </FormProvider>
  );
};

export { UserForm };
