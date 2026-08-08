"use client";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

type CoursesErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function CoursesErrorPage({ error, reset }: CoursesErrorPageProps) {
  return <RouteErrorFallback error={error} reset={reset} title="Courses error" />;
}
