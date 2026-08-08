"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type AssessmentsErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function AssessmentsErrorPage({ error, reset }: AssessmentsErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Assessment error" />;
}
