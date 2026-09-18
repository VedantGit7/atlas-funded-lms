"use client";

import { useCallback, useState } from "react";
import { Plus, Trash2, Save, X, Palette } from "lucide-react";
import { clientApi } from "../../lib/client-api";
import { ClientApiError } from "../../lib/api/errors";

type BrandColor = { name: string; hex: string };
type BrandFont = { label: string; family: string };
type BrandAsset = { name: string; url: string };

export type BrandKit = {
  id: string;
  name: string;
  logoUrl: string | null;
  colors: BrandColor[];
  fonts: BrandFont[];
  assets: BrandAsset[];
  createdAt: string;
  updatedAt: string;
};

type BrandKitListResponse = { data: BrandKit[] };
type BrandKitDetailResponse = { data: BrandKit };

type DraftKit = {
  name: string;
  logoUrl: string;
  colors: BrandColor[];
  fonts: BrandFont[];
  assets: BrandAsset[];
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function emptyDraft(): DraftKit {
  return {
    name: "",
    logoUrl: "",
    colors: [{ name: "Accent", hex: "#10D9A3" }],
    fonts: [],
    assets: [],
  };
}

function toDraft(kit: BrandKit): DraftKit {
  return {
    name: kit.name,
    logoUrl: kit.logoUrl ?? "",
    colors: kit.colors.map((c) => ({ ...c })),
    fonts: kit.fonts.map((f) => ({ ...f })),
    assets: kit.assets.map((a) => ({ ...a })),
  };
}

const CARD = "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";
const INPUT =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]";
const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-lg bg-[var(--admin-primary)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 disabled:opacity-50";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50";

export function CertificateBrandKitManager({ initialKits }: { initialKits: BrandKit[] }) {
  const [kits, setKits] = useState<BrandKit[]>(initialKits);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftKit>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await clientApi.get<BrandKitListResponse>("/api/v1/certificate-brand-kits");
    setKits(res.data);
  }, []);

  const validateDraft = useCallback((d: DraftKit): string | null => {
    if (d.name.trim().length === 0) return "Name is required.";
    for (const c of d.colors) {
      if (c.name.trim().length === 0) return "Every color needs a name.";
      if (!HEX_RE.test(c.hex))
        return `Color “${c.name || c.hex}” must be a 6-digit hex (e.g. #10D9A3).`;
    }
    for (const f of d.fonts) {
      if (f.label.trim().length === 0 || f.family.trim().length === 0)
        return "Every font needs a label and a font-family.";
    }
    for (const a of d.assets) {
      if (a.name.trim().length === 0 || a.url.trim().length === 0)
        return "Every asset needs a name and a URL.";
    }
    return null;
  }, []);

  const buildBody = useCallback((d: DraftKit) => {
    const logo = d.logoUrl.trim();
    return {
      name: d.name.trim(),
      logoUrl: logo.length > 0 ? logo : null,
      colors: d.colors.map((c) => ({ name: c.name.trim(), hex: c.hex })),
      fonts: d.fonts.map((f) => ({ label: f.label.trim(), family: f.family.trim() })),
      assets: d.assets.map((a) => ({ name: a.name.trim(), url: a.url.trim() })),
    };
  }, []);

  const startCreate = useCallback(() => {
    setEditingId(null);
    setDraft(emptyDraft());
    setCreating(true);
    setError(null);
  }, []);

  const startEdit = useCallback((kit: BrandKit) => {
    setCreating(false);
    setEditingId(kit.id);
    setDraft(toDraft(kit));
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }, []);

  const handleError = useCallback((e: unknown) => {
    setError(e instanceof ClientApiError ? e.message : "Something went wrong. Please try again.");
  }, []);

  const submitCreate = useCallback(async () => {
    const validation = validateDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi.post<BrandKitDetailResponse>(
        "/api/v1/certificate-brand-kits",
        buildBody(draft),
        "certificate-brand-kit-create",
        { successMessage: "Brand kit created" },
      );
      await refresh();
      setCreating(false);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }, [draft, validateDraft, buildBody, refresh, handleError]);

  const submitEdit = useCallback(async () => {
    if (!editingId) return;
    const validation = validateDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi.put<BrandKitDetailResponse>(
        "/api/v1/certificate-brand-kits",
        { id: editingId, ...buildBody(draft) },
        "certificate-brand-kit-update",
        { successMessage: "Brand kit updated" },
      );
      await refresh();
      setEditingId(null);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }, [editingId, draft, validateDraft, buildBody, refresh, handleError]);

  const remove = useCallback(
    async (kit: BrandKit) => {
      if (!window.confirm(`Delete brand kit “${kit.name}”? This cannot be undone.`)) return;
      setBusy(true);
      setError(null);
      try {
        await clientApi.delete(
          "/api/v1/certificate-brand-kits",
          "certificate-brand-kit-delete",
          { id: kit.id },
          { successMessage: "Brand kit deleted" },
        );
        await refresh();
        if (editingId === kit.id) setEditingId(null);
      } catch (e) {
        handleError(e);
      } finally {
        setBusy(false);
      }
    },
    [refresh, editingId, handleError],
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-text"
        >
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          className={BTN_PRIMARY}
          onClick={startCreate}
          disabled={creating || busy}
        >
          <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
          New brand kit
        </button>
      </div>

      {creating ? (
        <DraftEditor
          title="New brand kit"
          draft={draft}
          setDraft={setDraft}
          onSave={() => void submitCreate()}
          onCancel={cancel}
          busy={busy}
        />
      ) : null}

      {kits.length === 0 && !creating ? (
        <div className={`${CARD} flex flex-col items-center gap-2 p-10 text-center`}>
          <Palette className="h-8 w-8 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            No brand kits yet. Create one to reuse logos, colors and fonts across certificate
            designs.
          </p>
        </div>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2">
        {kits.map((kit) =>
          editingId === kit.id ? (
            <li key={kit.id} className="md:col-span-2">
              <DraftEditor
                title={`Edit “${kit.name}”`}
                draft={draft}
                setDraft={setDraft}
                onSave={() => void submitEdit()}
                onCancel={cancel}
                busy={busy}
              />
            </li>
          ) : (
            <li key={kit.id} className={`${CARD} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {kit.logoUrl ? (
                    <img
                      src={kit.logoUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-md object-contain"
                    />
                  ) : (
                    <span
                      className="grid h-10 w-10 place-items-center rounded-md bg-[var(--admin-surface-low)]"
                      aria-hidden="true"
                    >
                      <Palette className="h-5 w-5 text-[var(--admin-on-surface-variant)]" />
                    </span>
                  )}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      {kit.name}
                    </h3>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      {kit.colors.length} colors · {kit.fonts.length} fonts · {kit.assets.length}{" "}
                      assets
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className={BTN_GHOST}
                    onClick={() => {
                      startEdit(kit);
                    }}
                    disabled={busy}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-destructive/30 p-2 text-destructive-text transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    aria-label={`Delete ${kit.name}`}
                    onClick={() => void remove(kit)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {kit.colors.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {kit.colors.map((c) => (
                    <span key={`${c.name}-${c.hex}`} className="flex items-center gap-1.5">
                      <span
                        className="h-6 w-6 rounded-full border border-[var(--admin-border)]"
                        style={{ background: c.hex }}
                        aria-hidden="true"
                      />
                      <code className="text-xs text-[var(--admin-on-surface-variant)]">
                        {c.hex}
                      </code>
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function DraftEditor({
  title,
  draft,
  setDraft,
  onSave,
  onCancel,
  busy,
}: {
  title: string;
  draft: DraftKit;
  setDraft: (updater: (prev: DraftKit) => DraftKit) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <section className={`${CARD} p-5`}>
      <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">Name</span>
          <input
            className={INPUT}
            value={draft.name}
            onChange={(e) => {
              setDraft((p) => ({ ...p, name: e.target.value }));
            }}
            placeholder="e.g. Primary brand kit"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
            Logo URL
          </span>
          <input
            className={INPUT}
            value={draft.logoUrl}
            onChange={(e) => {
              setDraft((p) => ({ ...p, logoUrl: e.target.value }));
            }}
            placeholder="/brand/avatar-gradient.svg"
          />
        </label>
      </div>

      <RepeatableGroup
        label="Colors"
        addLabel="Add color"
        rows={draft.colors}
        onAdd={() => {
          setDraft((p) => ({ ...p, colors: [...p.colors, { name: "", hex: "#000000" }] }));
        }}
        onRemove={(i) => {
          setDraft((p) => ({ ...p, colors: p.colors.filter((_, idx) => idx !== i) }));
        }}
        renderRow={(row, i) => (
          <>
            <input
              className={INPUT}
              value={row.name}
              onChange={(e) => {
                setDraft((p) => ({
                  ...p,
                  colors: p.colors.map((c, idx) =>
                    idx === i ? { ...c, name: e.target.value } : c,
                  ),
                }));
              }}
              placeholder="Name"
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Color picker"
                className="h-9 w-10 shrink-0 cursor-pointer rounded border border-[var(--admin-border)] bg-transparent"
                value={HEX_RE.test(row.hex) ? row.hex : "#000000"}
                onChange={(e) => {
                  setDraft((p) => ({
                    ...p,
                    colors: p.colors.map((c, idx) =>
                      idx === i ? { ...c, hex: e.target.value } : c,
                    ),
                  }));
                }}
              />
              <input
                className={INPUT}
                value={row.hex}
                onChange={(e) => {
                  setDraft((p) => ({
                    ...p,
                    colors: p.colors.map((c, idx) =>
                      idx === i ? { ...c, hex: e.target.value } : c,
                    ),
                  }));
                }}
                placeholder="#10D9A3"
              />
            </div>
          </>
        )}
      />

      <RepeatableGroup
        label="Fonts"
        addLabel="Add font"
        rows={draft.fonts}
        onAdd={() => {
          setDraft((p) => ({ ...p, fonts: [...p.fonts, { label: "", family: "" }] }));
        }}
        onRemove={(i) => {
          setDraft((p) => ({ ...p, fonts: p.fonts.filter((_, idx) => idx !== i) }));
        }}
        renderRow={(row, i) => (
          <>
            <input
              className={INPUT}
              value={row.label}
              onChange={(e) => {
                setDraft((p) => ({
                  ...p,
                  fonts: p.fonts.map((f, idx) => (idx === i ? { ...f, label: e.target.value } : f)),
                }));
              }}
              placeholder="Label (e.g. Heading)"
            />
            <input
              className={INPUT}
              value={row.family}
              onChange={(e) => {
                setDraft((p) => ({
                  ...p,
                  fonts: p.fonts.map((f, idx) =>
                    idx === i ? { ...f, family: e.target.value } : f,
                  ),
                }));
              }}
              placeholder='CSS font-family (e.g. "Plus Jakarta Sans", sans-serif)'
            />
          </>
        )}
      />

      <RepeatableGroup
        label="Assets"
        addLabel="Add asset"
        rows={draft.assets}
        onAdd={() => {
          setDraft((p) => ({ ...p, assets: [...p.assets, { name: "", url: "" }] }));
        }}
        onRemove={(i) => {
          setDraft((p) => ({ ...p, assets: p.assets.filter((_, idx) => idx !== i) }));
        }}
        renderRow={(row, i) => (
          <>
            <input
              className={INPUT}
              value={row.name}
              onChange={(e) => {
                setDraft((p) => ({
                  ...p,
                  assets: p.assets.map((a, idx) =>
                    idx === i ? { ...a, name: e.target.value } : a,
                  ),
                }));
              }}
              placeholder="Name (e.g. Seal)"
            />
            <input
              className={INPUT}
              value={row.url}
              onChange={(e) => {
                setDraft((p) => ({
                  ...p,
                  assets: p.assets.map((a, idx) => (idx === i ? { ...a, url: e.target.value } : a)),
                }));
              }}
              placeholder="URL"
            />
          </>
        )}
      />

      <div className="mt-5 flex items-center gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={onSave} disabled={busy}>
          <Save className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
          Save
        </button>
        <button type="button" className={BTN_GHOST} onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
          Cancel
        </button>
      </div>
    </section>
  );
}

function RepeatableGroup<T>({
  label,
  addLabel,
  rows,
  onAdd,
  onRemove,
  renderRow,
}: {
  label: string;
  addLabel: string;
  rows: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderRow: (row: T, index: number) => React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
          {label}
        </span>
        <button type="button" className={BTN_GHOST} onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.25} />
          {addLabel}
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            {renderRow(row, i)}
            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-[var(--admin-border)] p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)]"
              aria-label={`Remove ${label} row ${i + 1}`}
              onClick={() => {
                onRemove(i);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
