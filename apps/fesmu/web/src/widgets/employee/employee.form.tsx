import { PromFieldSelect } from "@/features/lib/form";
import { UserFieldSelect } from "@/widgets/user";
import type { FC } from "react";
import { FormProvider } from "react-hook-form";
import { EMPLOYEE_DEPARTMENT_LABEL } from "./employee.fn";
import type { useEmployeeForm } from "./employee.fn";
import type { EmployeeSchema } from "./employee.schema";

const buildDepartmentOptions = () =>
    Object.entries(EMPLOYEE_DEPARTMENT_LABEL)
        .filter(([value]) => Number(value) !== 0)
        .map(([value, label]) => ({ value: Number(value), label }));

type EmployeeFormProps = ReturnType<typeof useEmployeeForm>;
const EmployeeForm: FC<EmployeeFormProps> = ({ form, handleSubmit }) => {
    type FormData = EmployeeSchema;
    const FieldSelect = PromFieldSelect<FormData>;

    return (
        <FormProvider {...form}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <UserFieldSelect name="userId" />

                <FieldSelect
                    name="department"
                    label="Отдел"
                    placeholder="Выберите отдел"
                    options={buildDepartmentOptions()}
                />

                <button
                    type="submit"
                    className="ml-auto w-fit bg-primary text-primary-foreground py-2 px-6 rounded-lg hover:opacity-90 transition-opacity"
                >
                    Добавить сотрудника
                </button>
            </form>
        </FormProvider>
    );
};

export { EmployeeForm };
