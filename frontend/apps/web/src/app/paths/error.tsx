"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type PathsErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function PathsErrorPage({ error, reset }: PathsErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Learning path error" />;
}
