"use client";

import type { ImgHTMLAttributes } from "react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

export type TenantLogoProps = {
  publicName: string;
  /** Explicit logo URL (overrides light/dark selection). */
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  className?: string;
  width?: number;
  height?: number;
  imageClassName?: string;
  imageProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height">;
};

export function resolveTenantLogoUrl(options: {
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  mode: "light" | "dark";
}): string | null {
  if (options.logoUrl) {
    return options.logoUrl;
  }

  if (options.mode === "dark") {
    return options.logoDarkUrl ?? options.logoLightUrl ?? null;
  }

  return options.logoLightUrl ?? options.logoDarkUrl ?? null;
}

function useDocumentTheme(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const sync = () => {
      setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return mode;
}

/**
 * Reserved logo slot with publicName wordmark fallback (§5.1 interim logo rule).
 */
export function TenantLogo({
  publicName,
  logoUrl,
  logoLightUrl,
  logoDarkUrl,
  className,
  width = 160,
  height = 32,
  imageClassName,
  imageProps,
}: TenantLogoProps) {
  const mode = useDocumentTheme();
  const resolvedLogoUrl = resolveTenantLogoUrl({
    ...(logoUrl !== undefined ? { logoUrl } : {}),
    ...(logoLightUrl !== undefined ? { logoLightUrl } : {}),
    ...(logoDarkUrl !== undefined ? { logoDarkUrl } : {}),
    mode,
  });

  if (resolvedLogoUrl) {
    return (
      <span className={cn("relative inline-flex min-h-8 max-w-[10rem] items-center", className)}>
        <Image
          src={resolvedLogoUrl}
          alt={publicName}
          width={width}
          height={height}
          className={cn("h-8 w-auto object-contain", imageClassName)}
          {...imageProps}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex min-h-8 max-w-full items-center text-base font-semibold leading-tight tracking-tight",
        className,
      )}
      title={publicName}
    >
      <span className="truncate">{publicName}</span>
    </span>
  );
}

export { TenantLogo as BrandingMark };
