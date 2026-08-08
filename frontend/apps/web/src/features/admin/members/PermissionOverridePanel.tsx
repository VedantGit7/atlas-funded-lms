"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  AnimatedCollapsible,
  collapseEase,
  PermissionCataloguePicker,
} from "../permissions/PermissionCataloguePicker";
import {
  cardClassName,
  cardHeaderClassName,
  fieldClassName,
  labelClassName,
  permissionDescription,
} from "./member-detail-shared";

type PermissionOverridePanelProps = {
  membershipId: string;
  overrides: Array<{
    id: string;
    permissionKey: string;
    effect: "ALLOW" | "DENY";
    reason: string | null;
  }>;
};

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

function effectBadgeClassName(effect: "ALLOW" | "DENY"): string {
  if (effect === "ALLOW") {
    return "bg-[var(--admin-primary-container)] text-[var(--admin-primary)]";
  }
  return "bg-[var(--admin-danger)]/15 text-[var(--admin-danger)]";
}

function EffectToggle({
  value,
  onChange,
}: {
  value: "ALLOW" | "DENY";
  onChange: (effect: "ALLOW" | "DENY") => void;
}) {
  return (
    <div
      className="inline-flex w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1 sm:w-auto"
      role="radiogroup"
      aria-label="Override effect"
    >
      {(["ALLOW", "DENY"] as const).map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              onChange(option);
            }}
            className={[
              "flex-1 rounded-md px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all sm:flex-none",
              active
                ? option === "ALLOW"
                  ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-sm"
                  : "bg-[var(--admin-danger)] text-white shadow-sm"
                : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function PermissionOverridePanel({ membershipId, overrides }: PermissionOverridePanelProps) {
  const router = useRouter();
  const formPanelId = useId();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [effect, setEffect] = useState<"ALLOW" | "DENY">("ALLOW");
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [permissionBrowseOpen, setPermissionBrowseOpen] = useState(false);

  const permissionKey = selectedKeys[0] ?? "";
  const selectedDescription = permissionKey ? permissionDescription(permissionKey) : null;
  const canSubmit = permissionKey.length > 0 && busyId !== "create";

  function resetCreateForm() {
    setSelectedKeys([]);
    setEffect("ALLOW");
    setReason("");
    setPermissionBrowseOpen(false);
    setErrorMessage(null);
  }

  function closeCreateForm() {
    setCreateOpen(false);
    resetCreateForm();
  }

  async function createOverride() {
    if (!permissionKey) return;

    setBusyId("create");
    setErrorMessage(null);

    try {
      await clientApi.post(
        "/api/v1/permission-overrides",
        {
          membershipId,
          permissionKey,
          effect,
          reason: reason.trim() || null,
        },
        "permission-override-create",
      );
      closeCreateForm();
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOverride(overrideId: string) {
    setBusyId(overrideId);
    setErrorMessage(null);

    try {
      await clientApi.delete(
        `/api/v1/permission-overrides/${overrideId}`,
        "permission-override-delete",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={cardClassName}>
      <div className={cardHeaderClassName}>
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
          Permission Overrides
        </h2>
        <button
          type="button"
          onClick={() => {
            if (createOpen) {
              closeCreateForm();
              return;
            }
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)]"
          aria-expanded={createOpen}
          aria-controls={formPanelId}
        >
          {createOpen ? (
            <>
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add override
            </>
          )}
        </button>
      </div>

      {errorMessage && !createOpen ? (
        <p
          role="alert"
          className="mx-6 mt-4 rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {errorMessage}
        </p>
      ) : null}

      {overrides.length > 0 ? (
        <div className="divide-y divide-[var(--admin-border)]">
          {overrides.map((override) => {
            const description =
              permissionDescription(override.permissionKey) ?? override.reason ?? "Custom override";

            return (
              <div
                key={override.id}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[var(--admin-surface-low)]/70"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-[var(--admin-on-surface)]">
                    {override.permissionKey}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
                    {description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={[
                      "rounded px-3 py-1 text-xs font-semibold uppercase tracking-wider",
                      effectBadgeClassName(override.effect),
                    ].join(" ")}
                  >
                    {override.effect}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove override for ${override.permissionKey}`}
                    disabled={busyId === override.id}
                    onClick={() => {
                      void deleteOverride(override.id);
                    }}
                    className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-danger)] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : !createOpen ? (
        <p className="px-6 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No permission overrides for this member.
        </p>
      ) : null}

      <AnimatedCollapsible open={createOpen} id={formPanelId} noTopMargin>
        <form
          className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)]/50 px-6 py-6"
          onSubmit={(event) => {
            event.preventDefault();
            void createOverride();
          }}
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <div>
                <p className={labelClassName}>Permission</p>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Select one permission key to override for this member.
                </p>
              </div>

              {permissionKey ? (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--admin-primary)]/25 bg-[var(--admin-primary-container)]/25 p-4">
                  <div className="min-w-0">
                    <code className="font-mono text-sm font-medium text-[var(--admin-primary-strong)]">
                      {permissionKey}
                    </code>
                    {selectedDescription ? (
                      <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                        {selectedDescription}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Clear selected permission"
                    onClick={() => {
                      setSelectedKeys([]);
                    }}
                    className="shrink-0 rounded-full p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] hover:text-[var(--admin-danger)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--admin-border)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                  No permission selected yet. Browse the catalogue below.
                </p>
              )}

              <PermissionCataloguePicker
                selectedKeys={selectedKeys}
                onChange={setSelectedKeys}
                selectionMode="single"
                browseOpen={permissionBrowseOpen}
                onBrowseOpenChange={setPermissionBrowseOpen}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 border-t border-[var(--admin-border)] pt-6 sm:grid-cols-2">
              <div className="space-y-2">
                <p className={labelClassName}>Effect</p>
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Whether this override grants or denies the permission.
                </p>
                <EffectToggle value={effect} onChange={setEffect} />
              </div>

              <div className="space-y-2">
                <label htmlFor="override-reason" className={labelClassName}>
                  Reason
                </label>
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Optional audit note for compliance and support.
                </p>
                <input
                  id="override-reason"
                  className={fieldClassName}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                  }}
                  placeholder="Optional audit note"
                />
              </div>
            </div>

            {errorMessage ? (
              <p
                role="alert"
                className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
              >
                {errorMessage}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-[var(--admin-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                {permissionKey
                  ? `This will ${effect === "ALLOW" ? "grant" : "deny"} ${permissionKey} for this member.`
                  : "Select a permission to continue."}
              </p>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ transitionTimingFunction: collapseEase }}
              >
                {busyId === "create" ? "Creating…" : "Create override"}
              </button>
            </div>
          </div>
        </form>
      </AnimatedCollapsible>
    </section>
  );
}
