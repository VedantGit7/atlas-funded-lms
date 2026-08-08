"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type LearnerErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function LearnerErrorPage({ error, reset }: LearnerErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Unable to load page" />;
}
