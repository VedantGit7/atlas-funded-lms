"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type RouteErrorFallbackProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}>;

export function RouteErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred. Try again.",
}: RouteErrorFallbackProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const requestId =
    typeof error.digest === "string" && /^req_[a-f0-9-]{36}$/i.test(error.digest)
      ? error.digest
      : null;

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {requestId ? (
        <p className="mt-4 text-xs text-muted-foreground">Request ID: {requestId}</p>
      ) : null}
      <Button type="button" variant="outline" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
