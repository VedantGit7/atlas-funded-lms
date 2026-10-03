"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  useForm,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
  type Resolver,
  type UseFormProps,
} from "react-hook-form";
import type { z } from "zod";

/** Load validation at the first validation event, without delaying the form itself. */
export function createLazyZodResolver<T extends FieldValues>(
  loadSchema: () => Promise<z.ZodType<T>>,
  errorField: FieldPath<T>,
): Resolver<T> {
  let pending: Promise<Resolver<T>> | undefined;
  return async (values, context, options) => {
    let resolve: Resolver<T>;
    try {
      pending ??= Promise.all([loadSchema(), import("@hookform/resolvers/zod")]).then(
        ([schema, { zodResolver }]) => zodResolver(schema as never) as Resolver<T>,
      );
      resolve = await pending;
    } catch {
      pending = undefined;
      // Never submit unvalidated credentials. Existing FormMessage renders this
      // on a visible field and the next submit retries the optional chunk.
      return {
        values: {},
        errors: {
          [errorField]: {
            type: "validate",
            message: "Unable to load validation. Please try again.",
          },
        } as FieldErrors<T>,
      };
    }
    return resolve(values, context, options);
  };
}

export function useLazyZodForm<T extends FieldValues>({
  schema,
  errorField,
  ...options
}: Omit<UseFormProps<T>, "resolver"> & {
  schema: () => Promise<z.ZodType<T>>;
  errorField: FieldPath<T>;
}) {
  const resolver = useMemo(() => createLazyZodResolver(schema, errorField), [schema, errorField]);
  const form = useForm<T>({ ...options, resolver });
  const originalHandleSubmit = useRef(form.handleSubmit);
  const submitting = useRef(false);
  const handleSubmit = useCallback<typeof form.handleSubmit>(
    (onValid, onInvalid) => async (event) => {
      // Lock synchronously: a second submit can arrive before React commits the
      // disabled button while the first submission is awaiting its schema chunk.
      if (submitting.current) {
        event?.preventDefault();
        return;
      }
      submitting.current = true;
      try {
        await originalHandleSubmit.current(onValid, onInvalid)(event);
      } finally {
        submitting.current = false;
      }
    },
    [],
  );
  // Preserve React Hook Form's stable methods object and its live formState.
  // Recovery-token effects depend on that identity; copying the object here
  // would retrigger them on every render.
  form.handleSubmit = handleSubmit;
  return form;
}
