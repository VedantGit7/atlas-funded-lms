"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type ReviewErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function ReviewErrorPage({ error, reset }: ReviewErrorPageProps) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      title="Review & Approvals"
      description="Something went wrong while loading this page."
    />
  );
}
