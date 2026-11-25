import { useEffect, useState } from "react";
import { FilePlusIcon } from "lucide-react";
import { CertificateOrderStatus } from "@fesmu/contract/fesmu/service/v1/certificate.service_pb";
import type { CertificateOrderEntry } from "@fesmu/contract/fesmu/service/v1/certificate.service_pb";
import { CommonWrapper } from "@/shared/components/wrapper";
import { PermissionAction, PermissionSection } from "@/shared/config/permissions";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useCan } from "@/features/access";
import { CancelDialog, CertificateJournalTable, OrderForDialog, STATUS_LABEL, useCertificateJournal, useStudentPicker } from "@/widgets/certificate-journal";

const STATUSES = [
    CertificateOrderStatus.ORDERED,
    CertificateOrderStatus.READY,
    CertificateOrderStatus.ISSUED,
    CertificateOrderStatus.CANCELLED,
    CertificateOrderStatus.UNSPECIFIED,
];

export default function CertificatesPage() {
    const journal = useCertificateJournal();
    const picker = useStudentPicker();
    const canView = useCan(PermissionSection.CERTIFICATE, PermissionAction.FETCH);
    const canIssue = useCan(PermissionSection.CERTIFICATE, PermissionAction.POST);
    const [orderOpen, setOrderOpen] = useState(false);
    const [cancelling, setCancelling] = useState<CertificateOrderEntry | null>(null);
    const scopeText = journal.scope.all
        ? "все факультеты"
        : journal.scope.faculties.join(", ");

    useEffect(() => {
        // Журнал — по праву просмотра; без него остаётся только «Сформировать».
        if (canView) void journal.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView]);

    const openOrder = () => {
        void picker.load();
        setOrderOpen(true);
    };

    return (
        <CommonWrapper
            title="Справки"
            description={
                canView
                    ? `Заказы студентов: напечатайте справку («Печать» — студент увидит «Готова к выдаче»), после подписи студента отметьте «Выдана». Видны заказы: ${scopeText}.`
                    : "Формирование справок за студентов"
            }
            action={
                canIssue && (
                    <Button onClick={openOrder}>
                        <FilePlusIcon className="size-4" />
                        Сформировать за студента
                    </Button>
                )
            }
            filter={
                canView
                    ? {
                          render: {
                              count: journal.orders.list.length,
                              children: (
                                  <Select value={String(journal.status)} onValueChange={(v) => journal.changeStatus(Number(v) as CertificateOrderStatus)}>
                                      <SelectTrigger className="w-auto min-w-48"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                          {STATUSES.map((s) => (
                                              <SelectItem key={s} value={String(s)}>
                                                  {s === CertificateOrderStatus.UNSPECIFIED ? "Все" : STATUS_LABEL[s]}
                                              </SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                              ),
                          },
                      }
                    : undefined
            }
        >
            <>
                {canView && (
                    <CertificateJournalTable
                        list={journal.orders.list}
                        canIssue={canIssue}
                        busy={journal.busy}
                        onPrint={journal.print}
                        onIssue={journal.issue}
                        onCancel={setCancelling}
                        isLoading={journal.orders.loading}
                        isError={journal.orders.error}
                        isEmpty={journal.orders.list.length === 0}
                    />
                )}
                <CancelDialog order={cancelling} onClose={() => setCancelling(null)} onSubmit={journal.cancel} />
                <OrderForDialog
                    open={orderOpen}
                    users={picker.users.list}
                    loading={picker.users.loading}
                    onClose={() => setOrderOpen(false)}
                    onSubmit={journal.orderFor}
                />
            </>
        </CommonWrapper>
    );
}
