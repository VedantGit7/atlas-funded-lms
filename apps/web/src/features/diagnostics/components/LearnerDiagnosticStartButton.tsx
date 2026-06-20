"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { diagnosticApiClient } from "../../../modules/diagnostics/diagnostic.api-client";

export function LearnerDiagnosticStartButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleStart() {
    setStatus("loading");
    setMessage(null);

    try {
      const started = await diagnosticApiClient.startAuthenticatedDiagnostic();
      router.push(`/diagnostic/me/${started.data.sessionId}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to start diagnostic.");
    }
  }

  return (
    <section className="rounded border p-4">
      <h1 className="text-2xl font-semibold">Diagnostic assessment</h1>
      <p className="mt-2 text-sm opacity-80">
        Measure your current competency themes with the generic Atlas diagnostic assessment.
      </p>
      {message ? (
        <p role="alert" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-4 rounded border px-4 py-2 font-medium"
        disabled={status === "loading"}
        onClick={() => void handleStart()}
      >
        {status === "loading" ? "Starting…" : "Start diagnostic"}
      </button>
    </section>
  );
}
