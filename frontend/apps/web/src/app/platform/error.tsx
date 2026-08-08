"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type PlatformErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function PlatformErrorPage({ error, reset }: PlatformErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Platform console error" />;
}
