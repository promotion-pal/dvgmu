/* eslint-disable react-refresh/only-export-components -- мелкие общие контролы конструктора QR */
import type { FC, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import type { QrDotStyle, QrEyeStyle, QrSubtitleBg, QrSubtitlePosition, QrTitlePosition } from "./qr-presets";

export const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const Segmented = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) => (
  <div className="flex flex-wrap gap-1">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={cn(
          "rounded-md border px-2.5 py-1 text-xs transition-colors",
          o.value === value ? "border-primary bg-primary/10" : "text-muted-foreground hover:bg-muted",
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    {children}
  </div>
);

export const DOT_OPTIONS: { value: QrDotStyle; label: string }[] = [
  { value: "square", label: "Квадраты" },
  { value: "rounded", label: "Скруглённые" },
  { value: "dots", label: "Точки" },
];
export const EYE_OPTIONS: { value: QrEyeStyle; label: string }[] = [
  { value: "square", label: "Квадрат" },
  { value: "rounded", label: "Скруглённый" },
  { value: "circle", label: "Круг" },
];


export const TITLE_POSITION_OPTIONS: { value: QrTitlePosition; label: string }[] = [
  { value: "below", label: "Под кодом" },
  { value: "above", label: "Над кодом" },
];
export const SUBTITLE_POSITION_OPTIONS: { value: QrSubtitlePosition; label: string }[] = [
  { value: "above", label: "Над плашкой" },
  { value: "below", label: "Под плашкой" },
];
export const SUBTITLE_BG_OPTIONS: { value: QrSubtitleBg; label: string }[] = [
  { value: "none", label: "Без фона" },
  { value: "light", label: "Светлый" },
  { value: "dark", label: "Тёмный" },
];

/** Ползунок с подписью значения — размеры кода и текста. */
export const ScaleSlider: FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, onChange }) => (
  <Field label={`${label}: ${Math.round(value * 100)}%`}>
    <input type="range" min={min} max={max} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </Field>
);
