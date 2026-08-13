"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormProps,
} from "react-hook-form";
import type { z } from "zod";

type UseZodFormProps<TFieldValues extends FieldValues> = Omit<
  UseFormProps<TFieldValues>,
  "resolver"
> & {
  schema: z.ZodType<TFieldValues>;
  defaultValues?: DefaultValues<TFieldValues>;
};

export function useZodForm<TFieldValues extends FieldValues>({
  schema,
  defaultValues,
  ...formProps
}: UseZodFormProps<TFieldValues>) {
  return useForm<TFieldValues>({
    ...formProps,
    ...(defaultValues === undefined ? {} : { defaultValues }),
    // Zod 4 + @hookform/resolvers: schema generics don't line up with FieldValues cleanly.
    resolver: zodResolver(schema as never) as Resolver<TFieldValues>,
  });
}
