import type { UserEmployeeDepartment } from "@dvgmu/mdm/enum/user.enum_pb";

/** Значение фильтра по подразделению: все, без подразделения или одно. */
export type DepartmentFilterValue = "all" | "none" | UserEmployeeDepartment;

/** Проходит ли набор подразделений человека фильтр. */
export const matchesDepartment = (departments: UserEmployeeDepartment[], filter: DepartmentFilterValue) =>
    filter === "all" ? true : filter === "none" ? departments.length === 0 : departments.includes(filter);
