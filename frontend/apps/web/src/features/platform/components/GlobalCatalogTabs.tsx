"use client";

import { useEffect, useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonDialog, PlatformReasonGate } from "./PlatformReasonDialog";

type Tab = "permissions" | "item-types" | "extension-points";

type PermissionRow = { id: string; key: string; description: string | null };
type ItemTypeRow = {
  id: string;
  key: string;
  name: string;
  rendererKey: string;
  isBuiltin: boolean;
};
type ExtensionPointRow = {
  id: string;
  key: string;
  pointType: string;
  status: string;
};

export function GlobalCatalogTabs() {
  const { reason, isValid } = usePlatformReason();
  const [tab, setTab] = useState<Tab>("permissions");
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemTypeRow[]>([]);
  const [extensionPoints, setExtensionPoints] = useState<ExtensionPointRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [draft, setDraft] = useState({
    key: "",
    description: "",
    name: "",
    rendererKey: "",
    pointType: "",
    schemaJson: "{}",
  });
  const [error, setError] = useState<string | null>(null);

  const listPath =
    tab === "permissions"
      ? "/api/v1/platform/catalog/permissions"
      : tab === "item-types"
        ? "/api/v1/platform/catalog/item-types"
        : "/api/v1/platform/catalog/extension-points";

  async function loadRows() {
    if (!reason) return;
    if (tab === "permissions") {
      const response = await platformApi.get<{ data: PermissionRow[] }>(listPath, reason);
      setPermissions(response.data);
      return;
    }
    if (tab === "item-types") {
      const response = await platformApi.get<{ data: ItemTypeRow[] }>(listPath, reason);
      setItemTypes(response.data);
      return;
    }
    const response = await platformApi.get<{ data: ExtensionPointRow[] }>(listPath, reason);
    setExtensionPoints(response.data);
  }

  useEffect(() => {
    if (!isValid || !reason) return;
    void loadRows().catch(() => {
      setPermissions([]);
      setItemTypes([]);
      setExtensionPoints([]);
    });
  }, [tab, isValid, reason]);

  async function createEntry() {
    if (!reason) return;

    setError(null);
    try {
      if (tab === "permissions") {
        await platformApi.post(
          listPath,
          { key: draft.key, description: draft.description || null, reason: actionReason },
          reason,
          "platform-catalog-permission",
        );
      } else if (tab === "item-types") {
        let schemaJson: Record<string, unknown> = {};
        if (draft.schemaJson.trim()) {
          schemaJson = JSON.parse(draft.schemaJson) as Record<string, unknown>;
        }
        await platformApi.post(
          listPath,
          {
            key: draft.key,
            name: draft.name,
            rendererKey: draft.rendererKey,
            schemaJson,
            reason: actionReason,
          },
          reason,
          "platform-catalog-item-type",
        );
      } else {
        let schemaJson: Record<string, unknown> = {};
        if (draft.schemaJson.trim()) {
          schemaJson = JSON.parse(draft.schemaJson) as Record<string, unknown>;
        }
        await platformApi.post(
          listPath,
          {
            key: draft.key,
            pointType: draft.pointType,
            schemaJson,
            reason: actionReason,
          },
          reason,
          "platform-catalog-extension-point",
        );
      }

      await loadRows();
      setCreateOpen(false);
      setReasonDialogOpen(false);
      setActionReason("");
      setDraft({
        key: "",
        description: "",
        name: "",
        rendererKey: "",
        pointType: "",
        schemaJson: "{}",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    }
  }

  return (
    <PlatformReasonGate ready={isValid}>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Global catalog</h1>
          <button
            type="button"
            className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            Add entry
          </button>
        </div>

        <div className="flex gap-2" role="tablist">
          {(["permissions", "item-types", "extension-points"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`rounded border px-3 py-1 text-sm ${
                tab === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
              onClick={() => {
                setTab(value);
              }}
            >
              {value}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {tab === "permissions" ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4">Key</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className="py-2 pr-4 font-mono">{row.key}</td>
                  <td className="py-2">{row.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === "item-types" ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4">Key</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Renderer</th>
                <th className="py-2">Builtin</th>
              </tr>
            </thead>
            <tbody>
              {itemTypes.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className="py-2 pr-4 font-mono">{row.key}</td>
                  <td className="py-2 pr-4">{row.name}</td>
                  <td className="py-2 pr-4 font-mono">{row.rendererKey}</td>
                  <td className="py-2">{row.isBuiltin ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === "extension-points" ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4">Key</th>
                <th className="py-2 pr-4">Point type</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {extensionPoints.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className="py-2 pr-4 font-mono">{row.key}</td>
                  <td className="py-2 pr-4">{row.pointType}</td>
                  <td className="py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg">
            <h2 className="text-lg font-semibold">Add catalog entry</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                Key
                <input
                  className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2 font-mono"
                  value={draft.key}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, key: event.target.value }));
                  }}
                />
              </label>
              {tab === "permissions" ? (
                <label className="block text-sm">
                  Description
                  <input
                    className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2"
                    value={draft.description}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, description: event.target.value }));
                    }}
                  />
                </label>
              ) : null}
              {tab === "item-types" ? (
                <>
                  <label className="block text-sm">
                    Name
                    <input
                      className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2"
                      value={draft.name}
                      onChange={(event) => {
                        setDraft((current) => ({ ...current, name: event.target.value }));
                      }}
                    />
                  </label>
                  <label className="block text-sm">
                    Renderer key
                    <input
                      className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2 font-mono"
                      value={draft.rendererKey}
                      onChange={(event) => {
                        setDraft((current) => ({ ...current, rendererKey: event.target.value }));
                      }}
                    />
                  </label>
                  <label className="block text-sm">
                    Schema JSON
                    <textarea
                      className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2 font-mono"
                      rows={3}
                      value={draft.schemaJson}
                      onChange={(event) => {
                        setDraft((current) => ({ ...current, schemaJson: event.target.value }));
                      }}
                    />
                  </label>
                </>
              ) : null}
              {tab === "extension-points" ? (
                <>
                  <label className="block text-sm">
                    Point type
                    <input
                      className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2"
                      value={draft.pointType}
                      onChange={(event) => {
                        setDraft((current) => ({ ...current, pointType: event.target.value }));
                      }}
                    />
                  </label>
                  <label className="block text-sm">
                    Schema JSON
                    <textarea
                      className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2 font-mono"
                      rows={3}
                      value={draft.schemaJson}
                      onChange={(event) => {
                        setDraft((current) => ({ ...current, schemaJson: event.target.value }));
                      }}
                    />
                  </label>
                </>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-border px-3 py-2 text-sm hover:bg-muted"
                onClick={() => {
                  setCreateOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
                onClick={() => {
                  setActionReason("");
                  setReasonDialogOpen(true);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PlatformReasonDialog
        open={reasonDialogOpen}
        title="Confirm catalog entry"
        description="Catalog mutations require an operational reason of at least 10 characters."
        value={actionReason}
        onChange={setActionReason}
        onConfirm={() => {
          void createEntry();
        }}
        onCancel={() => {
          setReasonDialogOpen(false);
        }}
      />
    </PlatformReasonGate>
  );
}
