import type { ReactNode } from "react";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import type { FieldValues, Path } from "react-hook-form";
import { useFormField } from "../prom.form";

interface PromFieldCheckboxProps<T extends FieldValues> {
  name: Path<T>;
  /** May hold links, e.g. "I agree to the <a>privacy policy</a>". */
  label?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export const PromFieldCheckbox = <T extends FieldValues>({
  name,
  label,
  className = "",
  disabled = false,
}: PromFieldCheckboxProps<T>) => {
  const { setValue, error, value } = useFormField<T>({ name });

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-start gap-2">
        <Checkbox
          id={name}
          checked={value === true}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onCheckedChange={(checked) => setValue(checked === true)}
          className="mt-0.5"
        />

        {label && (
          <Label htmlFor={name} className="text-sm font-normal leading-snug cursor-pointer">
            {label}
          </Label>
        )}
      </div>

      {error && <span className="text-red-500 text-sm">{error}</span>}
    </div>
  );
};
