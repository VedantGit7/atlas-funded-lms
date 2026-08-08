function Block({ className }: { className: string }) {
  return <div className={`fba-skeleton rounded-md ${className}`} />;
}

export default function DiagnosticResultLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-16" aria-hidden="true">
      <span className="sr-only">Loading diagnostic results…</span>
      <div className="flex flex-col items-center gap-6">
        <Block className="h-7 w-32 rounded-full" />
        <div className="fba-skeleton h-64 w-64 rounded-full" />
        <Block className="h-9 w-72" />
        <Block className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Block className="h-5 w-28" />
                <Block className="h-3 w-20" />
              </div>
              <div className="fba-skeleton h-[92px] w-[92px] rounded-full" />
            </div>
            <Block className="mt-4 h-4 w-full" />
          </div>
        ))}
      </div>
      <Block className="h-40 w-full rounded-2xl" />
    </div>
  );
}
