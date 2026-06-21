"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeatureFlagView } from "@atlas/domain-config/schemas/feature-flags";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type FeatureFlagsAdminProps = {
  flags: FeatureFlagView[];
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function FeatureFlagsAdmin({ flags }: FeatureFlagsAdminProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function saveFlag(flag: FeatureFlagView, rawValue: string) {
    if (flag.readOnly) {
      setMessage("This flag is entitlement-managed and read-only.");
      return;
    }

    setBusyKey(flag.key);
    setMessage(null);

    try {
      let value: unknown = rawValue;
      if (rawValue === "true") value = true;
      if (rawValue === "false") value = false;
      if (rawValue.startsWith("{") || rawValue.startsWith("[")) {
        value = JSON.parse(rawValue) as unknown;
      }

      await clientApi.put(
        `/api/v1/feature-flags/${encodeURIComponent(flag.key)}`,
        { value },
        `feature-flag-${flag.key}`,
      );
      router.refresh();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="space-y-4">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Tenant feature flags</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 pr-4">
              Key
            </th>
            <th scope="col" className="py-2 pr-4">
              Effective value
            </th>
            <th scope="col" className="py-2 pr-4">
              Source
            </th>
            <th scope="col" className="py-2">
              Override
            </th>
          </tr>
        </thead>
        <tbody>
          {flags.map((flag) => (
            <FeatureFlagRow
              key={flag.key}
              flag={flag}
              busy={busyKey === flag.key}
              onSave={(value) => {
                void saveFlag(flag, value);
              }}
            />
          ))}
        </tbody>
      </table>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}

function FeatureFlagRow({
  flag,
  busy,
  onSave,
}: {
  flag: FeatureFlagView;
  busy: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(
    typeof flag.value === "string" ? flag.value : JSON.stringify(flag.value),
  );

  return (
    <tr className="border-b align-top">
      <td className="py-3 pr-4 font-mono">{flag.key}</td>
      <td className="py-3 pr-4">{value}</td>
      <td className="py-3 pr-4">{flag.source}</td>
      <td className="py-3">
        {flag.readOnly ? (
          <span className="text-sm opacity-70">Read-only (entitlement-managed)</span>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSave(value);
            }}
          >
            <input
              className="min-w-40 rounded border px-2 py-1 font-mono"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
              }}
              aria-label={`Override value for ${flag.key}`}
            />
            <button type="submit" className="rounded border px-2 py-1" disabled={busy}>
              Save
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}
