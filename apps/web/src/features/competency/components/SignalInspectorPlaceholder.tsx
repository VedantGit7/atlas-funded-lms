export function SignalInspectorPlaceholder() {
  return (
    <section className="space-y-3 rounded border p-4">
      <header>
        <h2 className="font-medium">Signal inspector</h2>
        <p className="text-sm opacity-80">
          Raw competency signal inspection will be available in a later release. This placeholder
          does not call signal APIs.
        </p>
      </header>
      <p className="text-sm opacity-70">No signal data loaded.</p>
    </section>
  );
}
