import { Link } from "react-router-dom";
import { CommonWrapper } from "@/shared/components/wrapper";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { ScheduleInbox } from "@/widgets/schedule-collect";

export default function ScheduleInboxPage() {
    return (
        <CommonWrapper
            title="Поступившие сведения о занятиях"
            action={<Button asChild variant="outline"><Link to={ROUTE.SCHEDULA}>Календарь занятий</Link></Button>}
        >
            <ScheduleInbox />
        </CommonWrapper>
    );
}
