import { promAllowedPatternNaturalNumbers, PromFieldInput, PromFieldSelect, PromFieldTextArea } from "@/features/lib/form";
import { LocationCommonType } from "@fesmu/contract/fesmu/enum/v1/location.enum_pb";
import type { FC } from "react";
import { useEffect, useMemo } from "react";
import { FormProvider } from "react-hook-form";
import { LOCATION_COMMON_TYPE_LABEL, useInfrastructure } from "./infrastructure.fn";
import type { useInfrastructureForm } from "./infrastructure.fn";
import type { InfrastructureSchema } from "./infrastructure.schema";
import { sortInfrastructure } from "./infrastructure.filter";

const buildLocationOptions = () =>
    Object.entries(LOCATION_COMMON_TYPE_LABEL)
        .filter(([value]) => Number(value) !== LocationCommonType.UNSPECIFIED)
        .map(([value, label]) => ({ value: Number(value), label }));

type InfrastructureFormProps = ReturnType<typeof useInfrastructureForm>;
const InfrastructureForm: FC<InfrastructureFormProps> = ({ form, handleSubmit, isEditing }) => {
    type FormData = InfrastructureSchema;
    const FieldInput = PromFieldInput<FormData>;
    const FieldSelect = PromFieldSelect<FormData>;
    const FieldTextarea = PromFieldTextArea<FormData>;
    const locationOptions = useMemo(() => buildLocationOptions(), []);

    return (
        <FormProvider {...form}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FieldInput
                    name="title"
                    label="Название"
                    placeholder="Например: Серверная"
                />

                <FieldTextarea
                    name="description"
                    label="Описание"
                    placeholder="Кратко опишите помещение..."
                    rows={3}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FieldInput
                        name="floor"
                        label="Этаж"
                        placeholder="2"
                        allowedPattern={promAllowedPatternNaturalNumbers}
                        maxLength={2}
                    />

                    <FieldInput
                        name="room"
                        label="Кабинет"
                        placeholder="204"
                        allowedPattern={promAllowedPatternNaturalNumbers}
                        maxLength={4}
                    />
                </div>

                <FieldSelect
                    name="location"
                    label="Тип помещения"
                    options={locationOptions}
                />

                <button
                    type="submit"
                    className="ml-auto w-fit bg-primary text-primary-foreground py-2 px-6 rounded-lg hover:opacity-90 transition-opacity"
                >
                    {isEditing ? "Сохранить изменения" : "Добавить помещение"}
                </button>
            </form>
        </FormProvider>
    );
};

interface InfrastructureFieldSelectProps {
    name?: string;
    label?: string;
}
/** Room/location picker reused by other models whose entities reference an Infrastructure
 * by ID (e.g. inventory) — mirrors UserFieldSelect/DepartmentFieldSelect. */
const InfrastructureFieldSelect: FC<InfrastructureFieldSelectProps> = ({ name = "locationId", label = "Помещение" }) => {
    const { infrastructureRes } = useInfrastructure();

    useEffect(() => {
        infrastructureRes.fetch();
    }, []);

    return (
        <PromFieldSelect
            name={name}
            label={label}
            placeholder="Выберите помещение"
            options={sortInfrastructure(infrastructureRes.list).map((item) => ({
                label: item.floor ? `${item.title} · ${item.floor} эт.` : item.title,
                value: Number(item.id),
            }))}
        />
    );
};

export { InfrastructureForm, InfrastructureFieldSelect };
