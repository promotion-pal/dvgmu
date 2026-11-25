import { useEffect } from "react";
import { PlusIcon } from "lucide-react";
import { CommonShareLink } from "@/shared/components/share";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { VaccinationBoard, VaccinationDayFilter, VaccinationDayModal, VaccinationSignupModal, useVaccination } from "@/widgets/vaccination";

/** Staff page of the vaccination sign-up: add and remove days, see every
 * list, remove a sign-up made by mistake — and sign people up too. */
export default function VaccinationAdminPage() {
    const state = useVaccination({ editable: true });

    useEffect(() => {
        state.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CommonWrapper
            title="Запись на вакцинацию"
            description="Дни вакцинации и списки записавшихся"
            action={
                <div className="flex items-center gap-4">
                    <CommonShareLink label="Ссылка" />
                    <PlusIcon className="size-4 cursor-pointer" onClick={state.openCreateDay} aria-label="Добавить день" />
                </div>
            }
            filter={{ render: { className: "w-full", children: <VaccinationDayFilter state={state} /> } }}
        >
            <CommonControlState isLoading={state.loading && state.days.length === 0} isError={state.error} isEmpty={false}>
                <VaccinationBoard state={state} />
            </CommonControlState>
            <VaccinationSignupModal state={state} />
            <VaccinationDayModal state={state} />
        </CommonWrapper>
    );
}
