import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "destructive";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-muted text-foreground",
  outline: "border border-border text-foreground",
  success: "bg-success/15 text-success-text",
  warning: "bg-warning/15 text-warning-text",
  destructive: "bg-destructive/15 text-destructive-text",
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
