import { useEffect, useMemo, useState } from "react";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonPagination, CommonSearchInput, usePagination } from "@/shared/components/filter";
import { AuthIdentityTable, useAuthAdmin } from "@/widgets/auth-admin";

export function AuthAdmin() {
    const { fetch, identities } = useAuthAdmin();
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const query = search.trim().toLowerCase();

    const filteredIdentities = useMemo(() => {
        if (!query) return identities.list;

        return identities.list.filter((item) =>
            [item.login, item.email, item.objectGuid, item.mdmId.toString()]
                .some((value) => value.toLowerCase().includes(query)),
        );
    }, [identities.list, query]);

    const identitiesPage = usePagination(filteredIdentities, { resetKey: query });

    return (
        <CommonWrapper
            title="Авторизация"
            description="Администрирование: связи MDM ↔ AD (identity)"
            filter={{
                render: {
                    count: filteredIdentities.length,
                    children: (
                        <CommonSearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Поиск по логину, email, MDM ID или GUID"
                        />
                    ),
                },
            }}
        >
            <>
                <AuthIdentityTable
                    list={identitiesPage.pageItems}
                    isLoading={identities.loading}
                    isError={identities.error}
                    isEmpty={filteredIdentities.length === 0}
                />
                <CommonPagination {...identitiesPage.paginationProps} />
            </>
        </CommonWrapper>
    );
}
