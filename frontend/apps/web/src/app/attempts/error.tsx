"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type AttemptsErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function AttemptsErrorPage({ error, reset }: AttemptsErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Attempt error" />;
}
