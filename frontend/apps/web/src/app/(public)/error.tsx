"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type PublicErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function PublicErrorPage({ error, reset }: PublicErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Unable to load page" />;
}
