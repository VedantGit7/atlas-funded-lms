import type { ImgHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type AvatarSize = "sm" | "md" | "lg";

export type AvatarProps = {
  name?: string | null | undefined;
  src?: string | null | undefined;
  alt?: string;
  size?: AvatarSize;
  className?: string;
  /** Overrides the initials-tile colors (defaults to a neutral, theme-aware tint). */
  fallbackClassName?: string;
  imgProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "className">;
};

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function initialsOf(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return letters || trimmed.slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  src,
  alt,
  size = "md",
  className,
  fallbackClassName,
  imgProps,
}: AvatarProps) {
  const base = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
    sizeClasses[size],
    className,
  );

  if (src) {
    return (
      <img src={src} alt={alt ?? name ?? ""} className={cn(base, "object-cover")} {...imgProps} />
    );
  }

  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={cn(base, "bg-muted text-muted-foreground", fallbackClassName)}
    >
      {initialsOf(name)}
    </span>
  );
}
