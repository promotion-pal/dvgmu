import type { InputHTMLAttributes } from "react";
import type { FieldValues, Path} from "react-hook-form";
import { get, useFormContext, useWatch } from "react-hook-form";
import type z from "zod";

export interface PromFormFields extends InputHTMLAttributes<HTMLInputElement> { }

export interface PromFieldsConfig<S extends z.ZodSchema> {
  schema: S;
  defaultValues: z.infer<S>;
}

interface UseFormFieldProps<T extends FieldValues> {
  name: Path<T>;
}

export const useFormField = <T extends FieldValues>({
  name,
}: UseFormFieldProps<T>) => {
  const {
    register,
    formState: { errors },
    setValue,
    getValues,
    control,
  } = useFormContext<T>();

  // get() so nested names (field arrays, e.g. "questions.0.text") find their error too.
  const error = get(errors, name)?.message as string;
  // useWatch (a real subscription) instead of watch(): with the React Compiler
  // on, watch() doesn't trigger a re-render, so e.g. a picked file never showed up.
  const value = useWatch({ control, name });

  return {
    name,
    register: register(name),
    error,
    value,
    setValue: (val: any) => setValue(name, val),
    getValue: () => getValues(name),
  };
};
