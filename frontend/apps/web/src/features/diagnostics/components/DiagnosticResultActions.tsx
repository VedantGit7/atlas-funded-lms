"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { diagnosticApiClient } from "@atlas/contracts-modules/diagnostics/diagnostic.api-client";

export function DiagnosticResultActions() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function retake() {
    setStatus("loading");
    setError(null);
    try {
      const started = await diagnosticApiClient.startAuthenticatedDiagnostic();
      router.push(`/diagnostic/me/${started.data.sessionId}`);
    } catch (caught) {
      setStatus("idle");
      setError(caught instanceof Error ? caught.message : "Unable to start a new diagnostic.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
        <Link
          href="/progress"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
        >
          <BarChart3 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          View your progress
        </Link>

        <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

        <button
          type="button"
          onClick={() => void retake()}
          disabled={status === "loading"}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          Retake diagnostic
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
