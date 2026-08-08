"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type SettingsErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function SettingsErrorPage({ error, reset }: SettingsErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Settings error" />;
}
