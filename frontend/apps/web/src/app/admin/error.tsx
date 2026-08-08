"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type AdminErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function AdminErrorPage({ error, reset }: AdminErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Admin error" />;
}
