import type { ComponentProps, FC } from "react";
import type { Identity } from "@dvgmu/contract/packages/auth/v2/identity_pb";
import { CommonControlState } from "@/shared/components/state/control-state";
import { formatDate } from "@/features/utils/date";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

const MonoCell: FC<{ value?: string | bigint }> = ({ value }) => (
    <span className="font-mono text-xs">{value === undefined || value === "" ? "—" : value.toString()}</span>
);

interface AuthIdentityTableProps extends ComponentProps<typeof CommonControlState> {
    list: Identity[];
}
const AuthIdentityTable: FC<AuthIdentityTableProps> = ({ list, ...state }) => {
    return (
        <CommonControlState {...state}>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Логин</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>MDM ID</TableHead>
                        <TableHead>Object GUID (AD)</TableHead>
                        <TableHead>Синхронизирован</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {list.map((item) => (
                        <TableRow key={item.id.toString()}>
                            <TableCell><MonoCell value={item.id} /></TableCell>
                            <TableCell>{item.login || "—"}</TableCell>
                            <TableCell>{item.email || "—"}</TableCell>
                            <TableCell><MonoCell value={item.mdmId} /></TableCell>
                            <TableCell><MonoCell value={item.objectGuid} /></TableCell>
                            <TableCell>{formatDate("datetime", item.syncedAt)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CommonControlState>
    );
};

export { AuthIdentityTable };
