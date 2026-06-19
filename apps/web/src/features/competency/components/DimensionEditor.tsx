"use client";

import { useState } from "react";
import type { CompetencyDimensionDto } from "../../../server/competency/competency-config.types";
import {
  createCompetencyDimension,
  deleteCompetencyDimension,
  formatCompetencyConfigApiError,
  updateCompetencyDimension,
} from "../../../modules/competency/competency-config.api-client";

type DimensionEditorProps = {
  dimensions: CompetencyDimensionDto[];
  canManage: boolean;
  onChanged: () => void;
};

export function DimensionEditor({ dimensions, canManage, onChanged }: DimensionEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function onCreate() {
    setPending(true);
    setError(null);

    try {
      await createCompetencyDimension({
        key,
        name,
        description: description.trim() ? description.trim() : null,
      });
      setKey("");
      setName("");
      setDescription("");
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onDelete(dimension: CompetencyDimensionDto) {
    if (!window.confirm(`Delete dimension "${dimension.name}"?`)) return;

    setPending(true);
    setError(null);

    try {
      await deleteCompetencyDimension(dimension.id);
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onRename(dimension: CompetencyDimensionDto) {
    const nextName = window.prompt("Dimension name", dimension.name);
    if (!nextName || nextName.trim() === dimension.name) return;

    setPending(true);
    setError(null);

    try {
      await updateCompetencyDimension(dimension.id, { name: nextName.trim() });
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded border p-4">
      <header>
        <h2 className="font-medium">Dimensions</h2>
        <p className="text-sm opacity-80">Define generic competency dimensions for this tenant.</p>
      </header>

      {error ? (
        <div role="alert" className="rounded border p-3 text-sm">
          {error}
        </div>
      ) : null}

      {dimensions.length === 0 ? (
        <p className="text-sm opacity-80">No dimensions configured yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {dimensions.map((dimension) => (
            <li key={dimension.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <strong>{dimension.name}</strong>
                <span className="ml-2 opacity-70">({dimension.key})</span>
                {dimension.description ? (
                  <p className="opacity-70">{dimension.description}</p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    disabled={pending}
                    onClick={() => {
                      void onRename(dimension);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    disabled={pending}
                    onClick={() => {
                      void onDelete(dimension);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm">Key</span>
            <input
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
              }}
              className="w-full rounded border p-2"
              placeholder="execution_skill"
              disabled={pending}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Name</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="w-full rounded border p-2"
              placeholder="Risk Management"
              disabled={pending}
            />
          </label>
          <label className="space-y-1 md:col-span-1">
            <span className="text-sm">Description</span>
            <input
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className="w-full rounded border p-2"
              disabled={pending}
            />
          </label>
          <div className="md:col-span-3">
            <button
              type="button"
              className="rounded border px-3 py-2"
              disabled={pending || !key.trim() || !name.trim()}
              onClick={() => {
                void onCreate();
              }}
            >
              Add dimension
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
