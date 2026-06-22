"use client";

import { useEffect, useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonGate } from "./PlatformReasonDialog";

type Tab = "permissions" | "item-types" | "extension-points";

export function GlobalCatalogTabs() {
  const { reason, isValid } = usePlatformReason();
  const [tab, setTab] = useState<Tab>("permissions");
  const [rows, setRows] = useState<Array<{ id: string; key: string }>>([]);

  useEffect(() => {
    if (!isValid || !reason) {
      return;
    }

    const path =
      tab === "permissions"
        ? "/api/v1/platform/catalog/permissions"
        : tab === "item-types"
          ? "/api/v1/platform/catalog/item-types"
          : "/api/v1/platform/catalog/extension-points";

    platformApi
      .get<{ data: Array<{ id: string; key: string }> }>(path, reason)
      .then((response) => {
        setRows(response.data);
      })
      .catch(() => {
        setRows([]);
      });
  }, [tab, isValid, reason]);

  return (
    <PlatformReasonGate ready={isValid} onPrompt={() => undefined}>
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Global catalog</h1>
        <div className="flex gap-2">
          {(["permissions", "item-types", "extension-points"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded border px-3 py-1 text-sm ${
                tab === value ? "bg-neutral-900 text-white" : ""
              }`}
              onClick={() => {
                setTab(value);
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Key</th>
              <th className="py-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2 pr-4">{row.key}</td>
                <td className="py-2">{row.id.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PlatformReasonGate>
  );
}
