"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonDialog, PlatformReasonGate } from "./PlatformReasonDialog";
import {
  PlatformEntitlementEditor,
  entitlementDraftToApi,
  type EntitlementDraft,
} from "./PlatformEntitlementEditor";

export function ProvisionTenantWizard() {
  const router = useRouter();
  const { reason, isValid, promptForReason } = usePlatformReason();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialEntitlements, setInitialEntitlements] = useState<EntitlementDraft[]>([]);
  const [form, setForm] = useState({
    slug: "",
    displayName: "",
    ownerEmail: "",
    ownerDisplayName: "",
    seedProfile: "STANDARD" as "EMPTY" | "STANDARD",
  });

  async function submit() {
    if (!isValid || !reason) {
      promptForReason();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await platformApi.post<{ data: { id: string } }>(
        "/api/v1/platform/tenants",
        {
          slug: form.slug,
          displayName: form.displayName,
          owner: {
            email: form.ownerEmail,
            displayName: form.ownerDisplayName,
          },
          seedProfile: form.seedProfile,
          initialEntitlements: initialEntitlements
            .filter((row) => row.key.trim().length > 0)
            .map(entitlementDraftToApi),
        },
        reason,
        "platform-provision",
      );
      router.push(`/platform/tenants/${response.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provisioning failed.");
    } finally {
      setBusy(false);
      setDialogOpen(false);
    }
  }

  return (
    <PlatformReasonGate ready={isValid}>
      <section className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">Provision tenant</h1>
        <p className="text-sm opacity-70">
          Creates a tenant through the approved provisioning saga.
        </p>

        <label className="block text-sm">
          Slug
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.slug}
            onChange={(event) => {
              setForm((current) => ({ ...current, slug: event.target.value }));
            }}
          />
        </label>
        <label className="block text-sm">
          Display name
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.displayName}
            onChange={(event) => {
              setForm((current) => ({ ...current, displayName: event.target.value }));
            }}
          />
        </label>
        <label className="block text-sm">
          Owner email
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="email"
            value={form.ownerEmail}
            onChange={(event) => {
              setForm((current) => ({ ...current, ownerEmail: event.target.value }));
            }}
          />
        </label>
        <label className="block text-sm">
          Owner display name
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.ownerDisplayName}
            onChange={(event) => {
              setForm((current) => ({ ...current, ownerDisplayName: event.target.value }));
            }}
          />
        </label>
        <label className="block text-sm">
          Seed profile
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.seedProfile}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                seedProfile: event.target.value as "EMPTY" | "STANDARD",
              }));
            }}
          >
            <option value="STANDARD">Standard</option>
            <option value="EMPTY">Empty</option>
          </select>
        </label>

        <div className="space-y-2">
          <h2 className="text-lg font-medium">Initial entitlements</h2>
          <p className="text-sm opacity-70">
            Optional capability grants applied during provisioning.
          </p>
          <PlatformEntitlementEditor
            entitlements={initialEntitlements}
            onChange={setInitialEntitlements}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              if (!isValid) {
                promptForReason();
                return;
              }
              setActionReason(reason ?? "");
              setDialogOpen(true);
            }}
          >
            Provision tenant
          </button>
          <Link href="/platform" className="rounded border px-3 py-2 text-sm">
            Cancel
          </Link>
        </div>

        <PlatformReasonDialog
          open={dialogOpen}
          title="Confirm provisioning"
          description="Provisioning requires confirming the active operational reason for this session."
          value={actionReason}
          onChange={setActionReason}
          onConfirm={() => {
            void submit();
          }}
          onCancel={() => {
            setDialogOpen(false);
          }}
        />
      </section>
    </PlatformReasonGate>
  );
}
