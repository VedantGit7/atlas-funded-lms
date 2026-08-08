function Block({ className }: { className: string }) {
  return <div className={`rounded-md bg-muted motion-safe:animate-pulse ${className}`} />;
}

export default function ResourcesLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6" aria-hidden="true">
      <span className="sr-only">Loading resource library…</span>

      <div className="space-y-2">
        <Block className="h-8 w-56 max-w-full" />
        <Block className="h-4 w-[32rem] max-w-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="hidden space-y-5 rounded-xl border border-border bg-card p-4 lg:block">
          <div className="space-y-2">
            <Block className="h-3 w-24" />
            {[0, 1, 2].map((index) => (
              <Block key={index} className="h-7 w-full" />
            ))}
          </div>
          <div className="space-y-2">
            <Block className="h-3 w-20" />
            {[0, 1, 2].map((index) => (
              <Block key={index} className="h-7 w-full" />
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Block className="h-10 flex-1" />
              <Block className="h-10 w-20" />
              <Block className="h-10 w-28" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="aspect-video w-full bg-muted motion-safe:animate-pulse" />
                <div className="space-y-3 p-4">
                  <Block className="h-3 w-16" />
                  <Block className="h-4 w-3/4" />
                  <Block className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
