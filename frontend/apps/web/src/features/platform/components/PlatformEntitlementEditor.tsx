"use client";

export type EntitlementDraft = {
  key: string;
  enabled: boolean;
  valueRaw: string;
  expiresAt: string;
};

type PlatformEntitlementEditorProps = {
  entitlements: EntitlementDraft[];
  onChange: (entitlements: EntitlementDraft[]) => void;
};

export function parseEntitlementValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as unknown;
  }
  return trimmed;
}

export function entitlementDraftToApi(row: EntitlementDraft) {
  return {
    key: row.key.trim(),
    enabled: row.enabled,
    value: parseEntitlementValue(row.valueRaw),
    expiresAt: row.expiresAt.trim() ? new Date(row.expiresAt).toISOString() : null,
  };
}

export function entitlementFromApi(row: {
  key: string;
  enabled: boolean;
  value: unknown;
  expiresAt: string | null;
}): EntitlementDraft {
  let valueRaw = "";
  if (row.value != null) {
    valueRaw = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
  }
  return {
    key: row.key,
    enabled: row.enabled,
    valueRaw,
    expiresAt: row.expiresAt ? row.expiresAt.slice(0, 16) : "",
  };
}

export function PlatformEntitlementEditor({
  entitlements,
  onChange,
}: PlatformEntitlementEditorProps) {
  function updateRow(index: number, patch: Partial<EntitlementDraft>) {
    onChange(
      entitlements.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    onChange([...entitlements, { key: "", enabled: true, valueRaw: "", expiresAt: "" }]);
  }

  function removeRow(index: number) {
    onChange(entitlements.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className="space-y-3">
      {entitlements.map((entry, index) => (
        <div key={`${entry.key}-${index}`} className="rounded border p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <label className="block min-w-48 flex-1">
              <span className="font-medium">Key</span>
              <input
                className="mt-1 w-full rounded border px-2 py-1 font-mono"
                value={entry.key}
                onChange={(event) => {
                  updateRow(index, { key: event.target.value });
                }}
                placeholder="entitlement.key"
              />
            </label>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs"
              onClick={() => {
                removeRow(index);
              }}
            >
              Remove
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={entry.enabled}
              onChange={(event) => {
                updateRow(index, { enabled: event.target.checked });
              }}
            />
            Enabled
          </label>
          <label className="mt-2 block">
            <span className="font-medium">Value (JSON or boolean)</span>
            <input
              className="mt-1 w-full rounded border px-2 py-1 font-mono"
              value={entry.valueRaw}
              onChange={(event) => {
                updateRow(index, { valueRaw: event.target.value });
              }}
            />
          </label>
          <label className="mt-2 block">
            <span className="font-medium">Expires at (optional)</span>
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              type="datetime-local"
              value={entry.expiresAt}
              onChange={(event) => {
                updateRow(index, { expiresAt: event.target.value });
              }}
            />
          </label>
        </div>
      ))}
      <button type="button" className="rounded border px-3 py-2 text-sm" onClick={addRow}>
        Add entitlement
      </button>
    </div>
  );
}
