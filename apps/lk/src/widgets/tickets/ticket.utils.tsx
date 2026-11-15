export function formatTicketDate(createdAt: string): string {
  const date = new Date(Number(createdAt) * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
