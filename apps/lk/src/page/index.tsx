import { TicketsWidget } from "@/widgets/tickets";
import { Sidebar } from "@/widgets/layout/sidebar";

export function IndexPage() {
  return (
    <Sidebar>
      <TicketsWidget />
    </Sidebar>
  );
}
