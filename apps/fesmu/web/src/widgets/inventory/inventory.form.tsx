import { PromFieldInput, PromFieldSelect, PromFieldTextArea, PromDateField } from "@/features/lib/form";
import { InventoryStatus, InventoryType } from "@fesmu/contract/fesmu/enum/v1/inventory.enum_pb";
import { InfrastructureFieldSelect } from "../infrastructure";
import type { FC } from "react";
import { useMemo } from "react";
import { FormProvider } from "react-hook-form";
import { INVENTORY_STATUS_LABEL, INVENTORY_TYPE_LABEL } from "./Inventory.fn";
import type { useInventoryForm } from "./Inventory.fn";
import type { InventorySchema } from "./inventory.schema";

// Computed lazily inside the component, not at module scope — Inventory.fn/inventory.form/
// inventory.ui form a cycle (see inventory.ui.tsx), so reading INVENTORY_*_LABEL as a module-level
// constant here can run before Inventory.fn has finished initializing on a cold load.
const buildTypeOptions = () =>
    Object.entries(INVENTORY_TYPE_LABEL)
        .filter(([value]) => Number(value) !== InventoryType.UNSPECIFIED)
        .map(([value, label]) => ({ value: Number(value), label: label as string }));

const buildStatusOptions = () =>
    Object.entries(INVENTORY_STATUS_LABEL)
        .filter(([value]) => Number(value) !== InventoryStatus.UNSPECIFIED)
        .map(([value, label]) => ({ value: Number(value), label: label as string }));

type InventoryFormProps = ReturnType<typeof useInventoryForm>;
const InventoryForm: FC<InventoryFormProps> = ({ form, handleSubmit }) => {
    type FormData = InventorySchema;
    const FieldInput = PromFieldInput<FormData>;
    const FieldSelect = PromFieldSelect<FormData>;
    const FieldTextarea = PromFieldTextArea<FormData>;
    const DateField = PromDateField<FormData>;

    const typeOptions = useMemo(() => buildTypeOptions(), []);
    const statusOptions = useMemo(() => buildStatusOptions(), []);

    return (
        <FormProvider {...form}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FieldInput
                    name="title"
                    label="Название"
                    placeholder="Например: Ноутбук Lenovo ThinkPad"
                />

                <FieldTextarea
                    name="description"
                    label="Описание"
                    placeholder="Кратко опишите объект..."
                    rows={3}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FieldInput
                        name="inventoryNumber"
                        label="Инвентарный номер"
                        placeholder="INV-000123"
                    />

                    <FieldInput
                        name="serialNumber"
                        label="Серийный номер"
                        placeholder="SN-000123"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FieldSelect name="type" label="Тип" options={typeOptions} />
                    <FieldSelect name="status" label="Статус" options={statusOptions} />
                </div>

                <InfrastructureFieldSelect name="locationId" label="Помещение" />

                <FieldInput
                    name="responsibleUserId"
                    label="Ответственный (ID пользователя)"
                    placeholder="Необязательно"
                    allowedPattern={/^[0-9]*$/}
                />

                <FieldInput
                    name="purchasePrice"
                    label="Цена покупки"
                    placeholder="10000"
                    allowedPattern={/^[0-9]*\.?[0-9]*$/}
                />

                <DateField name="purchaseDate" label="Дата покупки" required={false} />

                <button
                    type="submit"
                    className="ml-auto w-fit bg-primary text-primary-foreground py-2 px-6 rounded-lg hover:opacity-90 transition-opacity"
                >
                    Добавить в инвентарь
                </button>
            </form>
        </FormProvider>
    );
};

export { InventoryForm };
