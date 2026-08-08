function Block({ className }: { className: string }) {
  return <div className={`fba-skeleton rounded-md ${className}`} />;
}

export default function DiagnosticCatalogLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10" aria-hidden="true">
      <span className="sr-only">Loading diagnostic assessments…</span>
      <div className="space-y-3">
        <Block className="h-8 w-64" />
        <Block className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <Block className="h-11 w-11 rounded-xl" />
              <Block className="h-6 w-24 rounded-full" />
            </div>
            <Block className="mt-5 h-6 w-40" />
            <Block className="mt-3 h-4 w-full" />
            <Block className="mt-2 h-4 w-3/4" />
            <div className="mt-6 flex justify-between border-t border-border pt-4">
              <Block className="h-4 w-20" />
              <Block className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
