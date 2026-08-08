"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  createCustomFieldDefinition,
  fetchCustomFieldDefinitions,
  type CustomFieldDefinition,
} from "./admin-domain-api";
import { AdminDomainPageShell, adminDomainCardClassName } from "./admin-domain-shared";

const FIELD_TYPES = ["text", "number", "boolean", "select", "date"] as const;

export function AdminCustomFieldsPanel() {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<(typeof FIELD_TYPES)[number]>("text");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomFieldDefinitions();
      setFields(response.data.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load custom fields.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!key.trim() || !label.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCustomFieldDefinition({ key: key.trim(), label: label.trim(), fieldType });
      setKey("");
      setLabel("");
      setFieldType("text");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create field.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminDomainPageShell
      title="Custom Fields"
      description="Define custom profile fields for learner memberships."
      error={error}
    >
      <div className={adminDomainCardClassName}>
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Create field</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(event) => void handleCreate(event)}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">Key</span>
            <input
              className={fieldClassName}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="my_field"
              pattern="[a-z][a-z0-9_]*"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">Label</span>
            <input className={fieldClassName} value={label} onChange={(e) => setLabel(e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">Type</span>
            <select
              className={fieldClassName}
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as (typeof FIELD_TYPES)[number])}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className={primaryButtonClassName} disabled={submitting}>
              {submitting ? "Creating…" : "Create field"}
            </button>
          </div>
        </form>
      </div>

      <section className={adminDomainCardClassName}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Definitions</h2>
          <button type="button" className={ghostButtonClassName} disabled={loading} onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
        ) : fields.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">No custom fields yet.</p>
        ) : (
          <div className={`${analyticsTableShellClassName} mt-4`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Key</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Label</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Type</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id} className={analyticsTableRowClassName}>
                    <td className="px-4 py-3 font-mono text-xs">{field.key}</td>
                    <td className="px-4 py-3">{field.label}</td>
                    <td className="px-4 py-3">{field.fieldType}</td>
                    <td className="px-4 py-3 capitalize">{field.status.toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        <Link
          href="/admin/reports/custom-field"
          className="font-semibold text-[var(--admin-primary)] hover:underline"
        >
          View custom field report
        </Link>
      </p>
    </AdminDomainPageShell>
  );
}
