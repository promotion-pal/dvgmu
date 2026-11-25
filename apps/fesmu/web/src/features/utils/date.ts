import type { Timestamp } from "@bufbuild/protobuf/wkt";

type DateFormatKind = "date" | "datetime";

export function formatDate(kind: DateFormatKind, timestamp?: Timestamp): string {
    if (!timestamp) return "—";

    const date = new Date(Number(timestamp.seconds) * 1000 + timestamp.nanos / 1e6);

    return kind === "datetime"
        ? date.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })
        : date.toLocaleDateString("ru-RU", { dateStyle: "medium" });
}
