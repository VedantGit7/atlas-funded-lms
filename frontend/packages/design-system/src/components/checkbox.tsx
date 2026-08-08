import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer rounded border border-neutral-300 accent-[var(--brand-primary,#6366f1)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#6366f1)]/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600",
        className,
      )}
      {...props}
    />
  );
});
