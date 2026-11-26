import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function TaskTime({ value }: { value?: Timestamp }) {
  if (!value) return "—";

  const date = timestampDate(value);
  return <time dateTime={date.toISOString()}>{dateTime.format(date)}</time>;
}
