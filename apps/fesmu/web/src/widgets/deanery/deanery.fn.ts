import { useMemo, useState } from "react";
import { ConnectError, createClient } from "@connectrpc/connect";
import { toast } from "sonner";
import { DeaneryService } from "@fesmu/contract/fesmu/service/v1/deanery.service_pb";
import type { DeaneryActivationCode, DeaneryStudent } from "@fesmu/contract/fesmu/service/v1/deanery.service_pb";
import { useFetchState } from "@/features/lib/fetch";
import { connectTransport } from "@/shared/config/api";

const deaneryClient = createClient(DeaneryService, connectTransport);

/** Сколько кодов за один запрос — как MaxIssue в api. */
const MAX_ISSUE = 200;

interface DeaneryFilters {
    search: string;
    course?: number;
    group?: string;
    /** Только студенты, которым можно выдать код. */
    onlyIssuable: boolean;
}

interface StudentGroup {
    group: string;
    course: number;
    faculty: string;
    students: DeaneryStudent[];
}

const matches = (s: DeaneryStudent, q: string) =>
    !q || [s.fullName, s.login, s.recordBook, s.group].some((v) => v.toLowerCase().includes(q));

/** Студенты своего факультета: поиск, фильтры по курсу и группе, выбор. */
const useDeaneryStudents = () => {
    const students = useFetchState<DeaneryStudent>();
    const [scope, setScope] = useState<{ all: boolean; faculties: string[] }>({ all: true, faculties: [] });
    // Демо-режим api: выдать можно всем, неподходящим — демо-код.
    const [demo, setDemo] = useState(false);
    const [filters, setFilters] = useState<DeaneryFilters>({ search: "", onlyIssuable: false });
    const [selected, setSelected] = useState<Set<bigint>>(new Set());

    const fetch = async () => {
        students.setLoading(true);
        students.setError(false);
        try {
            const res = await deaneryClient.deaneryStudentFetch({});
            students.setList(res.students);
            setScope({ all: res.allFaculties, faculties: res.faculties });
            setDemo(res.demo);
        } catch (error) {
            console.error("Ошибка при загрузке студентов:", error);
            students.setError(true);
        } finally {
            students.setLoading(false);
        }
    };

    const courses = useMemo(
        () => [...new Set(students.list.map((s) => s.course).filter((c) => c > 0))].sort((a, b) => a - b),
        [students.list],
    );
    // Группы — в пределах выбранного курса.
    const groups = useMemo(
        () =>
            [...new Set(students.list.filter((s) => !filters.course || s.course === filters.course).map((s) => s.group))]
                .filter(Boolean)
                .sort(),
        [students.list, filters.course],
    );

    const filtered = useMemo(() => {
        const q = filters.search.trim().toLowerCase();
        return students.list.filter(
            (s) =>
                (!filters.course || s.course === filters.course) &&
                (!filters.group || s.group === filters.group) &&
                (!filters.onlyIssuable || s.canIssue) &&
                matches(s, q),
        );
    }, [students.list, filters]);

    const grouped = useMemo(() => {
        const map = new Map<string, StudentGroup>();
        for (const s of filtered) {
            const key = s.group || "—";
            let g = map.get(key);
            if (!g) {
                g = { group: key, course: s.course, faculty: s.faculty, students: [] };
                map.set(key, g);
            }
            g.students.push(s);
        }
        return [...map.values()];
    }, [filtered]);

    const changeFilters = (patch: Partial<DeaneryFilters>) =>
        setFilters((f) => {
            const next = { ...f, ...patch };
            // Курс сменился — выбранная группа могла выпасть из списка.
            if (patch.course !== undefined && f.course !== patch.course) next.group = undefined;
            return next;
        });

    const toggle = (ids: bigint[], on: boolean) =>
        setSelected((prev) => {
            const next = new Set(prev);
            for (const id of ids) {
                if (on) next.add(id);
                else next.delete(id);
            }
            return next;
        });
    const clearSelection = () => setSelected(new Set());

    const selectedStudents = useMemo(
        () => students.list.filter((s) => selected.has(s.userId) && s.canIssue),
        [students.list, selected],
    );

    return {
        students,
        scope,
        demo,
        filters,
        changeFilters,
        courses,
        groups,
        filtered,
        grouped,
        selected,
        selectedStudents,
        toggle,
        clearSelection,
        fetch,
    };
};

/** Выдача кодов первого входа: открытые коды — только в ответе, храним до закрытия окна. */
const useActivationIssue = () => {
    const [sending, setSending] = useState(false);
    const [codes, setCodes] = useState<DeaneryActivationCode[] | null>(null);

    const issue = async (ids: bigint[]) => {
        if (ids.length === 0) return null;
        if (ids.length > MAX_ISSUE) {
            toast.error(`За раз — не больше ${MAX_ISSUE} студентов`);
            return null;
        }
        setSending(true);
        try {
            const res = await deaneryClient.deaneryActivationIssue({ userIds: ids });
            const ok = res.codes.filter((c) => c.code).length;
            const failed = res.codes.length - ok;
            if (ok > 0) toast.success(`Выдано кодов: ${ok}`);
            if (failed > 0) toast.warning(`Не выдано: ${failed} — причины в списке`);
            setCodes(res.codes);
            return res.codes;
        } catch (error) {
            console.error("Ошибка при выдаче кодов:", error);
            toast.error(ConnectError.from(error).rawMessage || "Не удалось выдать коды");
            return null;
        } finally {
            setSending(false);
        }
    };

    const reset = () => setCodes(null);

    return { sending, codes, issue, reset };
};

export { MAX_ISSUE, useActivationIssue, useDeaneryStudents };
export type { StudentGroup };
