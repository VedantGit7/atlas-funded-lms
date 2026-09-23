"use client";

import { useState } from "react";
import { MoreVertical, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import type { CompetencyDimensionDto } from "@atlas/contracts/competency/competency-config.types";
import {
  createCompetencyDimension,
  deleteCompetencyDimension,
  formatCompetencyConfigApiError,
  updateCompetencyDimension,
} from "@/modules/competency/competency-config.api-client";
import {
  alertErrorClassName,
  dimensionIconClassName,
  dimensionIconForIndex,
  fieldClassName,
  labelClassName,
  monoClassName,
  outlineButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
} from "../competency-admin-shared";

type DimensionEditorProps = {
  dimensions: CompetencyDimensionDto[];
  canManage: boolean;
  onChanged: () => void;
};

export function DimensionEditor({ dimensions, canManage, onChanged }: DimensionEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CompetencyDimensionDto | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<CompetencyDimensionDto | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

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
      setShowCreate(false);
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onDelete(dimension: CompetencyDimensionDto) {
    setPending(true);
    setError(null);

    try {
      await deleteCompetencyDimension(dimension.id);
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onEditSubmit() {
    if (!editTarget) return;

    setPending(true);
    setError(null);

    try {
      await updateCompetencyDimension(editTarget.id, {
        name: editName.trim(),
        description: editDescription.trim() ? editDescription.trim() : null,
      });
      setEditTarget(null);
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={panelClassName} aria-labelledby="dimensions-heading">
      <div className={panelHeaderClassName}>
        <h2 id="dimensions-heading" className={panelEyebrowClassName}>
          Dimensions
        </h2>
        {canManage ? (
          <button
            type="button"
            className={`${outlineButtonClassName} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs`}
            onClick={() => {
              setShowCreate((current) => !current);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add dimension
          </button>
        ) : null}
      </div>

      {error ? (
        <div className={`${alertErrorClassName} mx-4 mt-4 sm:mx-5`} role="alert">
          {error}
        </div>
      ) : null}

      {showCreate && canManage ? (
        <div
          className={`${panelBodyClassName} border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/50 space-y-3`}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className={labelClassName}>Key</span>
              <input
                value={key}
                onChange={(event) => {
                  setKey(event.target.value);
                }}
                className={fieldClassName}
                placeholder="risk_management"
                disabled={pending}
              />
            </label>
            <label className="space-y-1">
              <span className={labelClassName}>Name</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                className={fieldClassName}
                placeholder="Risk management"
                disabled={pending}
              />
            </label>
            <label className="space-y-1 md:col-span-1">
              <span className={labelClassName}>Description</span>
              <input
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
                className={fieldClassName}
                disabled={pending}
              />
            </label>
          </div>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={pending || !key.trim() || !name.trim()}
            onClick={() => {
              void onCreate();
            }}
          >
            Save dimension
          </button>
        </div>
      ) : null}

      {dimensions.length === 0 ? (
        <p className={`${panelBodyClassName} text-sm text-[var(--admin-on-surface-variant)]`}>
          No dimensions configured yet. Dimensions define the competency areas scored for learners.
        </p>
      ) : (
        <div className={`${panelBodyClassName} space-y-4`}>
          {dimensions.map((dimension, index) => {
            const Icon = dimensionIconForIndex(index);
            return (
              <div key={dimension.id} className="flex items-start gap-3">
                <div className={dimensionIconClassName}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={monoClassName}>{dimension.key}</span>
                    <span className="text-sm font-bold text-[var(--admin-on-surface)]">
                      {dimension.name}
                    </span>
                  </div>
                  {dimension.description ? (
                    <p className="mt-0.5 truncate text-[13px] text-[var(--admin-on-surface-variant)]">
                      {dimension.description}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      aria-label={`Actions for ${dimension.name}`}
                      aria-expanded={menuOpenId === dimension.id}
                      className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => {
                        setMenuOpenId((current) =>
                          current === dimension.id ? null : dimension.id,
                        );
                      }}
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {menuOpenId === dimension.id ? (
                      <div
                        className={`absolute right-0 top-full z-10 mt-1 min-w-[8rem] bg-[var(--admin-surface)] py-1 shadow-lg ${dropdownPanelSurfaceClassName}`}
                      >
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-high)]"
                          onClick={() => {
                            setMenuOpenId(null);
                            setEditTarget(dimension);
                            setEditName(dimension.name);
                            setEditDescription(dimension.description ?? "");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]"
                          onClick={() => {
                            setMenuOpenId(null);
                            setDeleteTarget(dimension);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title={`Delete dimension "${deleteTarget?.name ?? ""}"?`}
        description="Existing competency signals remain historical, but this dimension will no longer be configurable."
        confirmLabel="Delete dimension"
        destructive
        busy={pending}
        onConfirm={() => {
          if (deleteTarget) {
            void onDelete(deleteTarget);
          }
        }}
        onCancel={() => {
          setDeleteTarget(null);
        }}
      />

      {editTarget ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close edit dialog"
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm"
            onClick={() => {
              if (!pending) setEditTarget(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dimension-title"
            className="relative w-full max-w-md rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-2xl"
          >
            <h3
              id="edit-dimension-title"
              className="text-lg font-bold text-[var(--admin-on-surface)]"
            >
              Edit dimension
            </h3>
            <div className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className={labelClassName}>Name</span>
                <input
                  value={editName}
                  onChange={(event) => {
                    setEditName(event.target.value);
                  }}
                  className={fieldClassName}
                  disabled={pending}
                />
              </label>
              <label className="block space-y-1">
                <span className={labelClassName}>Description</span>
                <input
                  value={editDescription}
                  onChange={(event) => {
                    setEditDescription(event.target.value);
                  }}
                  className={fieldClassName}
                  disabled={pending}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={outlineButtonClassName}
                disabled={pending}
                onClick={() => {
                  setEditTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={pending || !editName.trim()}
                onClick={() => {
                  void onEditSubmit();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
