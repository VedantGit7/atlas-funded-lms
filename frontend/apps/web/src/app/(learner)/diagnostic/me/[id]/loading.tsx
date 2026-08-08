function Block({ className }: { className: string }) {
  return <div className={`fba-skeleton rounded-md ${className}`} />;
}

export default function DiagnosticRunnerLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8" aria-hidden="true">
      <span className="sr-only">Loading diagnostic…</span>
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Block className="h-3 w-32" />
            <Block className="h-7 w-48" />
          </div>
          <Block className="h-3 w-40" />
        </div>
        <Block className="h-1.5 w-full rounded-full" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <Block className="h-6 w-full max-w-md" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Block key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex justify-between border-t border-border pt-6">
        <Block className="h-11 w-28 rounded-xl" />
        <Block className="h-11 w-36 rounded-xl" />
      </div>
    </div>
  );
}
