import { PromFieldInput, PromFieldSelect, PromFieldSwitch } from "@/features/lib/form";
import { UserFieldSelect } from "@/widgets/user";
import type { FC } from "react";
import { FormProvider } from "react-hook-form";
import { STUDENT_EDUCATION_FORM_LABEL, STUDENT_STATUS_LABEL } from "./student.fn";
import type { useStudentForm } from "./student.fn";
import type { StudentSchema } from "./student.schema";

const buildEnumOptions = <T extends number>(labels: Record<T, string>) =>
    Object.entries(labels)
        .filter(([value]) => Number(value) !== 0)
        .map(([value, label]) => ({ value: Number(value), label: label as string }));

type StudentFormProps = ReturnType<typeof useStudentForm>;
const StudentForm: FC<StudentFormProps> = ({ form, handleSubmit }) => {
    type FormData = StudentSchema;
    const FieldInput = PromFieldInput<FormData>;
    const FieldSelect = PromFieldSelect<FormData>;
    const FieldSwitch = PromFieldSwitch<FormData>;

    return (
        <FormProvider {...form}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <UserFieldSelect name="userId" />

                <div className="grid grid-cols-2 gap-4">
                    <FieldInput name="group" label="Группа" placeholder="Л-101" />
                    <FieldInput name="recordBook" label="№ зачётки" placeholder="0120001" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FieldSelect
                        name="status"
                        label="Статус"
                        placeholder="Не указано"
                        options={buildEnumOptions(STUDENT_STATUS_LABEL)}
                    />
                    <FieldSelect
                        name="educationForm"
                        label="Форма обучения"
                        placeholder="Не указано"
                        options={buildEnumOptions(STUDENT_EDUCATION_FORM_LABEL)}
                    />
                </div>

                <FieldSwitch name="needsDormitory" label="Нуждается в общежитии" />

                <button
                    type="submit"
                    className="ml-auto w-fit bg-primary text-primary-foreground py-2 px-6 rounded-lg hover:opacity-90 transition-opacity"
                >
                    Добавить студента
                </button>
            </form>
        </FormProvider>
    );
};

export { StudentForm };
