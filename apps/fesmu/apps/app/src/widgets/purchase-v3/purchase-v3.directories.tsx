import { useEffect, useState } from "react";
import type { FC } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";
import type { PurchaseCategory, PurchaseCurator } from "@dvgmu/contract/entity/v3/purchase.entity_pb";
import { CommonSearchInput } from "@/shared/components/filter";
import { Button } from "@/shared/ui/button";
import type { PurchaseV3State } from "./purchase-v3.fn";
import { FIELD_CLASS, Section } from "./purchase-v3.ui";

/** A vice-rector's direction and the portal user who is that vice-rector. */
const CuratorRow: FC<{ state: PurchaseV3State; c?: PurchaseCurator; onDone?: () => void }> = ({ state, c, onDone }) => {
    const [title, setTitle] = useState(c?.title ?? "");
    const [shortTitle, setShortTitle] = useState(c?.shortTitle ?? "");
    const [personName, setPersonName] = useState(c?.personName ?? "");
    const [userUuid, setUserUuid] = useState(c?.userUuid ?? "");
    const people = state.employees[0] ?? [];
    const save = async () => {
        const user = people.find((p) => p.uuid === userUuid);
        const ok = await state.saveCurator({
            id: c?.id ?? 0n,
            title,
            shortTitle,
            personName: personName || user?.name || "",
            userUuid,
            userName: user?.name ?? c?.userName ?? "",
            sortOrder: c?.sortOrder ?? (state.overview?.curators.length ?? 0) + 1,
        });
        if (ok) onDone?.();
    };
    return (
        <div className="grid gap-2 rounded-lg border p-3 lg:grid-cols-[1.5fr_90px_1fr_1.2fr_auto]">
            <input className={FIELD_CLASS} placeholder="Проректор по цифровой трансформации" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className={FIELD_CLASS} placeholder="ЦТ" value={shortTitle} onChange={(e) => setShortTitle(e.target.value)} />
            <input className={FIELD_CLASS} placeholder="ФИО" value={personName} onChange={(e) => setPersonName(e.target.value)} />
            <select className={FIELD_CLASS} value={userUuid} onChange={(e) => setUserUuid(e.target.value)} aria-label="Пользователь портала">
                <option value="">— пользователь портала не привязан —</option>
                {c?.userUuid && !people.some((p) => p.uuid === c.userUuid) && <option value={c.userUuid}>{c.userName || c.userUuid}</option>}
                {people.map((p) => (
                    <option key={p.uuid} value={p.uuid}>
                        {p.name}
                    </option>
                ))}
            </select>
            <div className="flex gap-1">
                <Button size="sm" variant="secondary" disabled={state.busy || !title.trim()} onClick={save}>
                    Сохранить
                </Button>
                {c && (
                    <Button size="icon" variant="ghost" aria-label="Удалить" onClick={() => confirm(`Удалить «${c.title}»?`) && state.deleteCurator(c.id)}>
                        <TrashIcon className="size-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};

const CategoryRow: FC<{ state: PurchaseV3State; c?: PurchaseCategory; onDone?: () => void }> = ({ state, c, onDone }) => {
    const [name, setName] = useState(c?.name ?? "");
    const [prefix, setPrefix] = useState(c?.okpd2Prefix ?? "");
    const [department, setDepartment] = useState<number>(c?.implementingDepartment ?? 0);
    return (
        <div className="grid gap-2 sm:grid-cols-[1fr_110px_1.2fr_auto]">
            <input className={FIELD_CLASS} placeholder="Компьютерная техника" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={FIELD_CLASS} placeholder="26.20" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            <select className={FIELD_CLASS} value={department} onChange={(e) => setDepartment(Number(e.target.value))}>
                <option value={0}>— реализующий отдел —</option>
                {state.overview?.departments.map((d) => (
                    <option key={d.department} value={d.department}>
                        {d.name}
                    </option>
                ))}
            </select>
            <div className="flex gap-1">
                <Button
                    size="sm"
                    variant="secondary"
                    disabled={state.busy || !name.trim() || !prefix.trim() || !department}
                    onClick={async () => {
                        if (await state.saveCategory({ id: c?.id ?? 0n, name, okpd2Prefix: prefix, implementingDepartment: department })) onDone?.();
                    }}
                >
                    Сохранить
                </Button>
                {c && (
                    <Button size="icon" variant="ghost" aria-label="Удалить" onClick={() => confirm(`Удалить «${c.name}»?`) && state.deleteCategory(c.id)}>
                        <TrashIcon className="size-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};

/** What the route follows: directions, which department is in which, who carries out what. */
export const DirectoriesView: FC<{ state: PurchaseV3State }> = ({ state }) => {
    const [adding, setAdding] = useState(false);
    const [addingCategory, setAddingCategory] = useState(false);
    const [search, setSearch] = useState("");
    useEffect(() => {
        state.loadEmployees(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const curators = state.overview?.curators ?? [];
    const departments = (state.overview?.departments ?? []).filter((d) => d.name.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru")));
    const unassigned = (state.overview?.departments ?? []).filter((d) => !d.curatorId).length;

    return (
        <div className="flex flex-col gap-4">
            <Section
                title="Проректоры и их направления"
                action={
                    <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                        <PlusIcon className="size-4" /> Направление
                    </Button>
                }
            >
                <p className="text-xs text-muted-foreground">
                    Пользователь портала, привязанный к направлению, согласует заявки и закупки всех его отделов и видит общие страницы направления (при наличии
                    доступа «Просмотр общих страниц закупок проректором»).
                </p>
                {curators.map((c) => (
                    <CuratorRow key={`${c.id}-${c.userUuid}-${c.title}`} state={state} c={c} />
                ))}
                {adding && <CuratorRow state={state} onDone={() => setAdding(false)} />}
            </Section>

            <Section title={`Отделы и направления${unassigned ? ` — без проректора: ${unassigned}` : ""}`}>
                <p className="text-xs text-muted-foreground">Заявка отдела после начальника уходит проректору его направления; без направления дальше начальника она не пройдёт.</p>
                <CommonSearchInput value={search} onChange={setSearch} placeholder="Найти отдел" />
                <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
                    {departments.map((d) => (
                        <div key={d.department} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_280px]">
                            <span>{d.name}</span>
                            <select
                                className={FIELD_CLASS}
                                value={d.curatorId.toString()}
                                onChange={(e) => state.saveDepartment(d.department, BigInt(e.target.value))}
                                disabled={state.busy}
                            >
                                <option value="0">— не отнесён —</option>
                                {curators.map((c) => (
                                    <option key={c.id.toString()} value={c.id.toString()}>
                                        {c.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </Section>

            <Section
                title="Виды закупок: кто реализует"
                action={
                    <Button size="sm" variant="outline" onClick={() => setAddingCategory(true)}>
                        <PlusIcon className="size-4" /> Вид
                    </Button>
                }
            >
                <p className="text-xs text-muted-foreground">По началу кода ОКПД2, определённого из наименования, портал предлагает проректору реализующий отдел.</p>
                {state.overview?.categories.map((c) => <CategoryRow key={`${c.id}-${c.name}-${c.okpd2Prefix}-${c.implementingDepartment}`} state={state} c={c} />)}
                {addingCategory && <CategoryRow state={state} onDone={() => setAddingCategory(false)} />}
            </Section>
        </div>
    );
};
