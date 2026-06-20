"use client";

import { useState } from "react";
import { AnonymousDiagnosticScorecard } from "./AnonymousDiagnosticScorecard";
import { DiagnosticIdentityGate } from "./DiagnosticIdentityGate";

type AnonymousDiagnosticResultViewProps = {
  anonymousId: string;
};

export function AnonymousDiagnosticResultView({ anonymousId }: AnonymousDiagnosticResultViewProps) {
  const [identityGateOpen, setIdentityGateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <AnonymousDiagnosticScorecard anonymousId={anonymousId} />
      <button
        type="button"
        className="rounded border px-4 py-2"
        onClick={() => {
          setIdentityGateOpen(true);
        }}
      >
        Save my results
      </button>
      <DiagnosticIdentityGate
        anonymousId={anonymousId}
        open={identityGateOpen}
        onClose={() => {
          setIdentityGateOpen(false);
        }}
      />
    </div>
  );
}
