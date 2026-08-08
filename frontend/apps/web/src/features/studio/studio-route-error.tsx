"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

export function createStudioRouteError(title: string) {
  return function StudioRouteError({
    error,
    reset,
  }: Readonly<{
    error: Error & { digest?: string };
    reset: () => void;
  }>) {
    return <RouteErrorFallback error={error} reset={reset} title={title} />;
  };
}
