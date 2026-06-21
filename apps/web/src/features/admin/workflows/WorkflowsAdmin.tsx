"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type WorkflowDefinitionItem = {
  id: string;
  key: string;
  name: string;
  definitionJson: Record<string, unknown>;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  updatedAt: string;
};

type WorkflowsAdminProps = {
  definitions: WorkflowDefinitionItem[];
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function WorkflowsAdmin({ definitions }: WorkflowsAdminProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(definitions[0]?.id ?? "");
  const selected = definitions.find((item) => item.id === selectedId) ?? definitions[0] ?? null;
  const [name, setName] = useState(selected?.name ?? "");
  const [definitionJson, setDefinitionJson] = useState(
    JSON.stringify(selected?.definitionJson ?? {}, null, 2),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function selectDefinition(item: WorkflowDefinitionItem) {
    setSelectedId(item.id);
    setName(item.name);
    setDefinitionJson(JSON.stringify(item.definitionJson, null, 2));
    setMessage(null);
  }

  async function saveDefinition() {
    if (!selected) return;

    setBusy(true);
    setMessage(null);

    try {
      await clientApi.put(
        `/api/v1/workflows/${selected.id}`,
        {
          name,
          definitionJson: JSON.parse(definitionJson) as Record<string, unknown>,
        },
        `workflow-definition-${selected.id}`,
      );
      setMessage("Workflow definition saved.");
      router.refresh();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="text-sm font-medium">Definitions</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {definitions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`w-full rounded px-2 py-2 text-left ${
                  item.id === selected?.id ? "bg-neutral-100 font-medium" : ""
                }`}
                onClick={() => {
                  selectDefinition(item);
                }}
              >
                {item.name}
                <span className="block font-mono text-xs opacity-70">{item.key}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs opacity-70">
          Human review transitions remain on the Review &amp; Approvals screen.
        </p>
      </div>

      {selected ? (
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Name</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Definition JSON</span>
            <textarea
              className="min-h-64 w-full rounded border p-3 font-mono text-sm"
              value={definitionJson}
              onChange={(event) => {
                setDefinitionJson(event.target.value);
              }}
              aria-label={`Workflow definition JSON for ${selected.key}`}
            />
          </label>
          <button
            type="button"
            className="rounded border px-3 py-2"
            disabled={busy}
            onClick={() => {
              void saveDefinition();
            }}
          >
            Save definition
          </button>
          {message ? <p role="status">{message}</p> : null}
        </div>
      ) : (
        <p>No workflow definitions are configured for this tenant.</p>
      )}
    </section>
  );
}
