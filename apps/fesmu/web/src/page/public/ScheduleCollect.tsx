import { CommonWrapper } from "@/shared/components/wrapper";
import { useUserProvider } from "@/features/provider/user.provider";
import { ScheduleCollectPanel } from "@/widgets/schedule-collect";

export default function ScheduleCollectPage() {
    const userId = useUserProvider((state) => state.user?.uuid);

    return (
        <CommonWrapper
            title="Передача сведений о занятии"
            description="Отправьте сведения в отдел расписания. Каждое занятие отправляется отдельно."
        >
            {userId && <ScheduleCollectPanel key={userId} userId={userId} />}
        </CommonWrapper>
    );
}
