function Block({ className }: { className: string }) {
  return <div className={`rounded-md bg-muted motion-safe:animate-pulse ${className}`} />;
}

export default function ReadinessLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 md:space-y-12" aria-hidden="true">
      <span className="sr-only">Loading competency and readiness…</span>

      <div className="space-y-2">
        <Block className="h-8 w-72 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid items-center gap-8 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_1fr] md:gap-12 md:p-10">
        <div className="mx-auto h-64 w-64 rounded-full bg-muted motion-safe:animate-pulse md:mx-0" />
        <div className="space-y-3">
          <Block className="h-3 w-40" />
          <Block className="h-8 w-56" />
          <Block className="h-4 w-full max-w-xl" />
          <Block className="h-4 w-4/5 max-w-lg" />
        </div>
      </div>

      <div className="space-y-4">
        <Block className="h-6 w-52" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6"
            >
              <div className="h-24 w-24 rounded-full bg-muted motion-safe:animate-pulse" />
              <Block className="h-4 w-28" />
              <Block className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index} className="h-64 rounded-2xl border border-border bg-card motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
