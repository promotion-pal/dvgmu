import { z } from "zod";

export const inventorySchema = z.object({
    title: z.string().trim().min(1, "Название обязательно для заполнения"),
    description: z.string().trim().optional(),

    inventoryNumber: z.string().trim().min(1, "Инвентарный номер обязателен для заполнения"),
    serialNumber: z.string().trim().optional(),

    purchasePrice: z.coerce.number().nonnegative("Цена не может быть отрицательной").optional(),
    purchaseDate: z.string().optional(),

    locationId: z.coerce.number({ error: "Выберите помещение" }),
    responsibleUserId: z.coerce.number().optional(),

    status: z.coerce.number({ error: "Выберите статус" }),
    type: z.coerce.number({ error: "Выберите тип" }),
});
export type InventorySchema = z.infer<typeof inventorySchema>;
