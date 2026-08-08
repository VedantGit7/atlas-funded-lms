"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type AuthErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function AuthErrorPage({ error, reset }: AuthErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Authentication error" />;
}
