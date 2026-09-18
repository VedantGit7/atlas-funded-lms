import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "destructive";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[var(--brand-primary,#224466)] text-white",
  secondary: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
  outline:
    "border border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300",
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  destructive: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
