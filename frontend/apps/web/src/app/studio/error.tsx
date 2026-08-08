"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type StudioErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function StudioErrorPage({ error, reset }: StudioErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Studio error" />;
}
