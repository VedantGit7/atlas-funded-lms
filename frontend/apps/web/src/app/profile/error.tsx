"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type ProfileErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function ProfileErrorPage({ error, reset }: ProfileErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Profile error" />;
}
