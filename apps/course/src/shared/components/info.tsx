import { InfoIcon } from "lucide-react";

interface CommonInfoProps {
  text: string;
  className?: string;
}

export function CommonInfo({ text, className }: CommonInfoProps) {
  return (
    <span
      title={text}
      aria-label={text}
      className={`flex items-center text-muted-foreground ${className ?? ""}`}
    >
      <InfoIcon className="h-4 w-4" />
    </span>
  );
}
