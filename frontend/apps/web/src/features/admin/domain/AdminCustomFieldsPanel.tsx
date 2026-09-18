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
  fetchCustomFieldValues,
  setCustomFieldValue,
  type CustomFieldDefinition,
  type CustomFieldValue,
} from "./admin-domain-api";
import { AdminDomainPageShell, adminDomainCardClassName } from "./admin-domain-shared";

const FIELD_TYPES = ["text", "number", "boolean", "select", "date"] as const;

export function AdminCustomFieldsPanel() {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<(typeof FIELD_TYPES)[number]>("text");
  const [submitting, setSubmitting] = useState(false);
  const [valuesFor, setValuesFor] = useState<CustomFieldDefinition | null>(null);
  const [values, setValues] = useState<CustomFieldValue[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);
  const [assignMembershipId, setAssignMembershipId] = useState("");
  const [assignValue, setAssignValue] = useState("");
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomFieldDefinitions();
      setFields(response.data.items);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: React.SyntheticEvent) {
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
      setError(createError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleViewValues(field: CustomFieldDefinition) {
    setValuesFor(field);
    setLoadingValues(true);
    setError(null);
    try {
      const response = await fetchCustomFieldValues(field.id);
      setValues(response.data.items);
    } catch (valuesError) {
      setValues([]);
      setError(valuesError);
    } finally {
      setLoadingValues(false);
    }
  }

  /**
   * Parses the entered value according to the definition's own field type.
   *
   * The endpoint takes `valueJson: unknown` because the shape depends on the
   * definition, so sending a raw string for a number or boolean field would
   * store the wrong type and only surface later, in an export or a segment
   * filter that silently stops matching.
   */
  function parseValueForField(field: CustomFieldDefinition, raw: string): unknown {
    const trimmed = raw.trim();
    if (field.fieldType === "number") return Number(trimmed);
    if (field.fieldType === "boolean") return trimmed.toLowerCase() === "true";
    return trimmed;
  }

  async function handleAssignValue(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!valuesFor || !assignMembershipId.trim() || !assignValue.trim()) return;

    setAssigning(true);
    setError(null);
    try {
      await setCustomFieldValue(valuesFor.id, {
        membershipId: assignMembershipId.trim(),
        valueJson: parseValueForField(valuesFor, assignValue),
      });
      setAssignMembershipId("");
      setAssignValue("");
      await handleViewValues(valuesFor);
    } catch (assignError) {
      setError(assignError);
    } finally {
      setAssigning(false);
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
        <form
          className="mt-4 grid gap-3 sm:grid-cols-3"
          onSubmit={(event) => void handleCreate(event)}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Key
            </span>
            <input
              className={fieldClassName}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
              }}
              placeholder="my_field"
              pattern="[a-z][a-z0-9_]*"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Label
            </span>
            <input
              className={fieldClassName}
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
              }}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Type
            </span>
            <select
              className={fieldClassName}
              value={fieldType}
              onChange={(e) => {
                setFieldType(e.target.value as (typeof FIELD_TYPES)[number]);
              }}
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
          <button
            type="button"
            className={ghostButtonClassName}
            disabled={loading}
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
        ) : fields.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">
            No custom fields yet.
          </p>
        ) : (
          <div className={`${analyticsTableShellClassName} mt-4`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Key</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Label</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Type</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Status</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Values</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id} className={analyticsTableRowClassName}>
                    <td className="px-4 py-3 font-mono text-xs">{field.key}</td>
                    <td className="px-4 py-3">{field.label}</td>
                    <td className="px-4 py-3">{field.fieldType}</td>
                    <td className="px-4 py-3 capitalize">{field.status.toLowerCase()}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={ghostButtonClassName}
                        onClick={() => void handleViewValues(field)}
                      >
                        View values
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {valuesFor ? (
        <section className={adminDomainCardClassName}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Values — {valuesFor.label}
            </h2>
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                setValuesFor(null);
                setValues([]);
              }}
            >
              Close
            </button>
          </div>

          <form
            className="mt-4 grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => void handleAssignValue(e)}
          >
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                Membership ID
              </span>
              <input
                className={fieldClassName}
                value={assignMembershipId}
                onChange={(e) => {
                  setAssignMembershipId(e.target.value);
                }}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                Value ({valuesFor.fieldType})
              </span>
              <input
                className={fieldClassName}
                value={assignValue}
                onChange={(e) => {
                  setAssignValue(e.target.value);
                }}
                required
              />
            </label>
            <div className="flex items-end">
              <button type="submit" className={primaryButtonClassName} disabled={assigning}>
                {assigning ? "Saving…" : "Set value"}
              </button>
            </div>
          </form>

          {loadingValues ? (
            <p className="mt-4 text-sm text-[var(--admin-on-surface-variant)]">Loading values…</p>
          ) : values.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--admin-on-surface-variant)]">
              No members have a value for this field yet.
            </p>
          ) : (
            <div className={`${analyticsTableShellClassName} mt-4`}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Membership</th>
                    <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Value</th>
                    <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {values.map((value) => (
                    <tr key={value.membershipId} className={analyticsTableRowClassName}>
                      <td className="px-4 py-3 font-mono text-xs">{value.membershipId}</td>
                      <td className="px-4 py-3">{JSON.stringify(value.valueJson)}</td>
                      <td className="px-4 py-3">{new Date(value.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

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
