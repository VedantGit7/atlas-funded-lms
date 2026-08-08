"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";

type HiddenFormFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
};

export function HiddenFormField<TFieldValues extends FieldValues>({
  control,
  name,
}: HiddenFormFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="hidden">
          <FormControl>
            <input type="hidden" {...field} value={field.value ?? ""} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
