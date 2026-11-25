import { useEffect, useState } from "react";
import type { FC } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";
import { CommonSearchInput } from "@/shared/components/filter";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { purchaseV2Api } from "./purchase-v2.api";
import type { PurchaseV2State } from "./purchase-v2.fn";
import type { PurchaseCategory, PurchaseCurator, PurchaseEmployee } from "./purchase-v2.schema";
import { DepartmentSelect, FIELD_CLASS, Section } from "./purchase-v2.ui";

/** What the route is built from, kept by the administrator: who each
 * vice-rector is, who is over each department, who carries out each kind of
 * purchase. */
export const PurchaseDirectories: FC<{ state: PurchaseV2State }> = ({ state }) => {
    const [employees, setEmployees] = useState<PurchaseEmployee[]>();
    useEffect(() => {
        purchaseV2Api
            .employees(0)
            .then(setEmployees)
            .catch(() => setEmployees([]));
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <Curators state={state} employees={employees} />
            <Departments state={state} />
            <Categories state={state} />
        </div>
    );
};

const emptyCurator = (): PurchaseCurator => ({ id: "", name: "", position: "", userUuid: "", userName: "" });

const Curators: FC<{ state: PurchaseV2State; employees?: PurchaseEmployee[] }> = ({ state, employees }) => {
    const [adding, setAdding] = useState(false);
    return (
        <Section
            title="Проректоры"
            action={
                <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                    <PlusIcon className="size-4" /> Добавить
                </Button>
            }
        >
            <p className="text-xs text-muted-foreground">
                Привяжите каждого проректора к его учётной записи — тогда он видит заявки и закупки своего направления без выбора в переключателе.
            </p>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Проректор</TableHead>
                        <TableHead>Направление</TableHead>
                        <TableHead>Пользователь портала</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {state.overview.curators.map((c) => (
                        <CuratorRow key={`${c.id}:${c.userUuid}:${c.name}`} state={state} curator={c} employees={employees} />
                    ))}
                    {adding && <CuratorRow state={state} curator={emptyCurator()} employees={employees} onDone={() => setAdding(false)} />}
                </TableBody>
            </Table>
        </Section>
    );
};

const CuratorRow: FC<{ state: PurchaseV2State; curator: PurchaseCurator; employees?: PurchaseEmployee[]; onDone?: () => void }> = ({
    state,
    curator,
    employees,
    onDone,
}) => {
    const [form, setForm] = useState(curator);
    const changed = JSON.stringify(form) !== JSON.stringify(curator);
    return (
        <TableRow>
            <TableCell>
                <input className={FIELD_CLASS} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Проректор по …" />
            </TableCell>
            <TableCell>
                <input className={FIELD_CLASS} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </TableCell>
            <TableCell>
                <select
                    className={FIELD_CLASS}
                    value={form.userUuid}
                    onChange={(e) => {
                        const who = employees?.find((x) => x.uuid === e.target.value);
                        setForm({ ...form, userUuid: e.target.value, userName: who?.name ?? "" });
                    }}
                >
                    <option value="">— не привязан —</option>
                    {form.userUuid && !employees?.some((x) => x.uuid === form.userUuid) && <option value={form.userUuid}>{form.userName || form.userUuid}</option>}
                    {employees?.map((x) => (
                        <option key={x.uuid} value={x.uuid}>
                            {x.name}
                        </option>
                    ))}
                </select>
            </TableCell>
            <TableCell className="text-right">
                <Button
                    size="sm"
                    disabled={!changed || !form.name.trim() || state.busy}
                    onClick={async () => {
                        if (await state.saveCurator(form)) onDone?.();
                    }}
                >
                    Сохранить
                </Button>
            </TableCell>
        </TableRow>
    );
};

const Departments: FC<{ state: PurchaseV2State }> = ({ state }) => {
    const [search, setSearch] = useState("");
    const query = search.trim().toLocaleLowerCase("ru");
    const list = [...state.overview.departments]
        .sort((a, b) => a.name.localeCompare(b.name, "ru"))
        .filter((d) => !query || d.name.toLocaleLowerCase("ru").includes(query));
    const unassigned = state.overview.departments.filter((d) => !d.curatorId).length;
    return (
        <Section title={`Отделы и курирующие проректоры${unassigned ? ` · без проректора: ${unassigned}` : ""}`}>
            <p className="text-xs text-muted-foreground">Заявка отдела после согласования начальником уходит проректору, указанному здесь.</p>
            <CommonSearchInput value={search} onChange={setSearch} placeholder="Поиск отдела" />
            <div className="max-h-[28rem] overflow-y-auto">
                <Table>
                    <TableBody>
                        {list.map((d) => (
                            <TableRow key={d.id}>
                                <TableCell className="whitespace-normal">{d.name}</TableCell>
                                <TableCell className="w-80">
                                    <select
                                        className={FIELD_CLASS}
                                        value={d.curatorId}
                                        disabled={state.busy}
                                        onChange={(e) => state.saveDepartment(d.id, e.target.value)}
                                    >
                                        <option value="">— не назначен —</option>
                                        {state.overview.curators.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Section>
    );
};

const emptyCategory = (): PurchaseCategory => ({ id: "", name: "", okpd2Prefix: "", department: 0 });

const Categories: FC<{ state: PurchaseV2State }> = ({ state }) => {
    const [adding, setAdding] = useState(false);
    return (
        <Section
            title="Виды закупок и реализующие отделы"
            action={
                <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                    <PlusIcon className="size-4" /> Добавить
                </Button>
            }
        >
            <p className="text-xs text-muted-foreground">
                По наименованию заявки портал подбирает код ОКПД2 и предлагает проректору отдел, у которого начало кода совпадает дольше всего.
            </p>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Вид закупки</TableHead>
                        <TableHead className="w-32">ОКПД2 начинается с</TableHead>
                        <TableHead>Реализующий отдел</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {state.overview.categories.map((c) => (
                        <CategoryRow key={`${c.id}:${c.name}:${c.okpd2Prefix}:${c.department}`} state={state} category={c} />
                    ))}
                    {adding && <CategoryRow state={state} category={emptyCategory()} onDone={() => setAdding(false)} />}
                </TableBody>
            </Table>
        </Section>
    );
};

const CategoryRow: FC<{ state: PurchaseV2State; category: PurchaseCategory; onDone?: () => void }> = ({ state, category, onDone }) => {
    const [form, setForm] = useState(category);
    const changed = JSON.stringify(form) !== JSON.stringify(category);
    const valid = form.name.trim() && form.okpd2Prefix.trim() && form.department;
    return (
        <TableRow>
            <TableCell>
                <input className={FIELD_CLASS} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </TableCell>
            <TableCell>
                <input className={FIELD_CLASS} value={form.okpd2Prefix} onChange={(e) => setForm({ ...form, okpd2Prefix: e.target.value })} placeholder="26.20" />
            </TableCell>
            <TableCell>
                <DepartmentSelect state={state} value={form.department} onChange={(department) => setForm({ ...form, department })} label="" />
            </TableCell>
            <TableCell className="whitespace-nowrap text-right">
                <Button
                    size="sm"
                    disabled={!changed || !valid || state.busy}
                    onClick={async () => {
                        if (await state.saveCategory(form)) onDone?.();
                    }}
                >
                    Сохранить
                </Button>
                {category.id && (
                    <Button
                        size="icon"
                        variant="ghost"
                        title="Удалить"
                        disabled={state.busy}
                        onClick={() => confirm(`Удалить вид «${category.name}»?`) && state.deleteCategory(category.id)}
                    >
                        <TrashIcon className="size-4" />
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
};
