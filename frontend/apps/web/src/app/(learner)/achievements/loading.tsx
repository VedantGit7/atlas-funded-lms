function Block({ className }: { className: string }) {
  return <div className={`rounded-md bg-muted motion-safe:animate-pulse ${className}`} />;
}

export default function AchievementsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8" aria-hidden="true">
      <span className="sr-only">Loading achievements…</span>

      <div className="space-y-2">
        <Block className="h-8 w-56 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted motion-safe:animate-pulse" />
              <div className="space-y-2">
                <Block className="h-3 w-20" />
                <Block className="h-5 w-24" />
              </div>
            </div>
            <Block className="h-6 w-12" />
          </div>
        ))}
      </div>

      <div className="h-40 rounded-2xl border border-border bg-card motion-safe:animate-pulse md:h-48" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="space-y-4">
            <Block className="h-6 w-40" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-40 rounded-xl border border-border bg-card motion-safe:animate-pulse"
                />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Block className="h-6 w-36" />
            {[0, 1].map((index) => (
              <div
                key={index}
                className="h-28 rounded-xl border border-border bg-card motion-safe:animate-pulse"
              />
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="h-96 rounded-2xl border border-border bg-card motion-safe:animate-pulse" />
          <div className="h-40 rounded-2xl border border-border bg-card motion-safe:animate-pulse" />
        </div>
      </div>

      <div className="h-72 rounded-2xl border border-border bg-card motion-safe:animate-pulse" />
    </div>
  );
}
