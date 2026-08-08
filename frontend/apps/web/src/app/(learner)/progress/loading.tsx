function Block({ className }: { className: string }) {
  return <div className={`rounded-md bg-muted motion-safe:animate-pulse ${className}`} />;
}

export default function ProgressLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8" aria-hidden="true">
      <span className="sr-only">Loading progress…</span>

      <div className="space-y-2">
        <Block className="h-8 w-56 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <Block className="h-3 w-24" />
              <div className="h-9 w-9 rounded-lg bg-muted motion-safe:animate-pulse" />
            </div>
            <Block className="h-8 w-20" />
            <Block className="h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <Block className="h-5 w-44" />
          <Block className="h-3 w-28" />
        </div>
        <div className="px-6 py-6">
          <div className="h-28 w-full rounded-md bg-muted motion-safe:animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="h-64 rounded-2xl border border-border bg-card motion-safe:animate-pulse"
          />
        ))}
      </div>

      <div className="space-y-6">
        <Block className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-72 rounded-2xl border border-border bg-card motion-safe:animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
