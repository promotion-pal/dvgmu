import { useFetchState } from "@/features/lib/fetch";
import { IdentityService } from "@fesmu/contract/auth/v2/identity_pb";
import type { Identity } from "@fesmu/contract/auth/v2/identity_pb";
import { connectTransport } from "@/shared/config/api";
import { createClient } from "@connectrpc/connect";

const identityClient = createClient(IdentityService, connectTransport);

const IDENTITY_PAGE_SIZE = 500;

const useAuthAdmin = () => {
    const identityState = useFetchState<Identity>();

    const fetchIdentities = async () => {
        identityState.setLoading(true);
        identityState.setError(false);

        try {
            const identities: Identity[] = [];
            for (let page = 1; ; page++) {
                const response = await identityClient.fetchIdentity({ page, pageSize: IDENTITY_PAGE_SIZE });
                identities.push(...response.identities);
                if (response.identities.length === 0 || BigInt(identities.length) >= response.total) break;
            }
            identityState.setList(identities);
        } catch (error) {
            console.error("Ошибка при получении списка identity:", error);
            identityState.setError(true);
        } finally {
            identityState.setLoading(false);
        }
    };

    return {
        fetch: fetchIdentities,
        identities: identityState,
    };
};

export { useAuthAdmin };
