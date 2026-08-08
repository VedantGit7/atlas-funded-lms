"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type RoadmapErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function RoadmapErrorPage({ error, reset }: RoadmapErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Roadmap error" />;
}
