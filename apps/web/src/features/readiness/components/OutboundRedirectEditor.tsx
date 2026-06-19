"use client";

type OutboundRedirectEditorProps = {
  outboundTargetUrl: string;
  tokenTtlSeconds: number;
  onTargetUrlChange: (value: string) => void;
  onTokenTtlChange: (value: number) => void;
  disabled?: boolean;
};

export function OutboundRedirectEditor({
  outboundTargetUrl,
  tokenTtlSeconds,
  onTargetUrlChange,
  onTokenTtlChange,
  disabled,
}: OutboundRedirectEditorProps) {
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-lg font-semibold">Outbound redirect target</h2>
      <p className="text-sm opacity-80">
        Target URL is configured by admins only. Learners cannot supply a destination URL.
      </p>
      <label className="block text-sm">
        HTTPS target URL
        <input
          className="mt-1 block w-full rounded border px-2 py-1"
          type="url"
          value={outboundTargetUrl}
          disabled={disabled}
          onChange={(event) => {
            onTargetUrlChange(event.target.value);
          }}
        />
      </label>
      <label className="block text-sm">
        Token TTL (seconds)
        <input
          className="mt-1 block w-full rounded border px-2 py-1"
          type="number"
          min={60}
          max={86400}
          value={tokenTtlSeconds}
          disabled={disabled}
          onChange={(event) => {
            onTokenTtlChange(Number(event.target.value));
          }}
        />
      </label>
    </section>
  );
}
