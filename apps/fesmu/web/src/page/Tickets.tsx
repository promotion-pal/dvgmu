import { DormitoryTicketBoard, BuildTicketBoard } from "@/widgets/tickets";

export default function TicketsPage() {
    return (
        <div className="flex flex-col gap-6 w-full">
            <DormitoryTicketBoard />
            <BuildTicketBoard />
        </div>
    );
}
