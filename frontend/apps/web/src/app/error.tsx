"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type ErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} />;
}
