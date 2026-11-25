import { ReactNode } from "react";

interface DetailRowProps {
  label: string;
  value: ReactNode;
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 py-1.5 last:border-0">
      <dt className="col-span-1 text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words">{value}</dd>
    </div>
  );
}
