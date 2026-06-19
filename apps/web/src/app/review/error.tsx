"use client";

type ReviewErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ReviewErrorPage({ error, reset }: ReviewErrorPageProps) {
  return (
    <main className="space-y-4">
      <h1>Review & Approvals</h1>
      <p role="alert">Something went wrong while loading this page.</p>
      {error.digest ? <p className="text-sm opacity-80">Request ID: {error.digest}</p> : null}
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
