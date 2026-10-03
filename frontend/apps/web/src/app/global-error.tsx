"use client";

import { reportClientError } from "../observability/report-client-error";
import { useEffect } from "react";

type GlobalErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    void reportClientError(error);
  }, [error]);

  const requestId =
    typeof error.digest === "string" && /^req_[a-f0-9-]{36}$/i.test(error.digest)
      ? error.digest
      : null;

  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-lg p-6">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm opacity-80">An unexpected error occurred. Try again.</p>
          {requestId ? <p className="mt-4 text-xs opacity-70">Request ID: {requestId}</p> : null}
          <button type="button" className="mt-4 rounded border px-4 py-2 text-sm" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
