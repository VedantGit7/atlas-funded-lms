"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type ModerationErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function ModerationErrorPage({ error, reset }: ModerationErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Moderation error" />;
}
