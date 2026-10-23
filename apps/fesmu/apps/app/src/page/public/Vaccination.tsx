import { useEffect } from "react";
import { CommonShareLink } from "@/shared/components/share";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { VaccinationBoard, VaccinationDayFilter, VaccinationSignupModal, useVaccination } from "@/widgets/vaccination";

/** Public sign-up for vaccination — no login: pick a time, enter your name,
 * and it shows up in the list right away. */
export default function PublicVaccinationPage() {
    const state = useVaccination();

    useEffect(() => {
        state.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CommonWrapper
            title="Запись на вакцинацию"
            description="Выберите удобное время и запишитесь — в каждом слоте 12 мест."
            action={<CommonShareLink label="Ссылка на запись" />}
            filter={state.days.length > 1 ? { render: { className: "w-full", children: <VaccinationDayFilter state={state} /> } } : undefined}
        >
            <CommonControlState isLoading={state.loading && state.days.length === 0} isError={state.error} isEmpty={false}>
                <VaccinationBoard state={state} />
            </CommonControlState>
            <VaccinationSignupModal state={state} />
        </CommonWrapper>
    );
}
