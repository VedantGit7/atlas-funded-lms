"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { diagnosticApiClient } from "@atlas/contracts-modules/diagnostics/diagnostic.api-client";
import { DiagnosticResultScorecard } from "./DiagnosticResultScorecard";
import type { DiagnosticScorecard } from "@atlas/contracts-modules/diagnostics/diagnostic.types";

type AnonymousDiagnosticScorecardProps = {
  anonymousId: string;
};

export function AnonymousDiagnosticScorecard({ anonymousId }: AnonymousDiagnosticScorecardProps) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "denied">("loading");
  const [scorecard, setScorecard] = useState<DiagnosticScorecard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void diagnosticApiClient
      .getPublicDiagnosticResult(anonymousId)
      .then((response) => {
        if (cancelled) return;
        setScorecard(response.data.scorecard);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load scorecard.";
        setErrorMessage(message);
        setState(message.includes("401") ? "denied" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [anonymousId]);

  if (state === "loading") {
    return <p role="status">Loading your preliminary scorecard…</p>;
  }

  if (state === "denied") {
    return (
      <section className="rounded border p-4">
        <h1 className="text-xl font-semibold">Session verification required</h1>
        <p className="mt-2 text-sm opacity-80">
          Your diagnostic session could not be verified. Start a new diagnostic to continue.
        </p>
        <Link href="/diagnostic" className="mt-4 inline-block rounded border px-4 py-2">
          Start diagnostic
        </Link>
      </section>
    );
  }

  if (state === "error" || !scorecard) {
    return (
      <section className="rounded border p-4">
        <h1 className="text-xl font-semibold">Unable to load scorecard</h1>
        <p className="mt-2 text-sm opacity-80">{errorMessage ?? "Please try again."}</p>
        <Link href="/diagnostic" className="mt-4 inline-block rounded border px-4 py-2">
          Retry diagnostic
        </Link>
      </section>
    );
  }

  return <DiagnosticResultScorecard scorecard={scorecard} />;
}
