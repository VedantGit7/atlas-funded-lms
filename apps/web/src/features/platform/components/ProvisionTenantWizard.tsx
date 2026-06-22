"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonDialog } from "./PlatformReasonDialog";

export function ProvisionTenantWizard() {
  const router = useRouter();
  const { reason, isValid, setReason } = usePlatformReason();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: "",
    displayName: "",
    ownerEmail: "",
    ownerDisplayName: "",
    seedProfile: "STANDARD" as "EMPTY" | "STANDARD",
  });

  async function submit() {
    if (!isValid || !reason) {
      setDialogOpen(true);
      return;
    }

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
          initialEntitlements: [],
        },
        reason,
        "platform-provision",
      );
      router.push(`/platform/tenants/${response.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provisioning failed.");
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Provision tenant</h1>
      <p className="text-sm opacity-70">Creates a tenant through the approved provisioning saga.</p>

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

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
          onClick={() => {
            void submit();
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
        title="Confirm provisioning reason"
        description="Provisioning requires an operational reason of at least 10 characters."
        value={actionReason}
        onChange={setActionReason}
        onConfirm={() => {
          setReason(actionReason);
          setDialogOpen(false);
        }}
        onCancel={() => {
          setDialogOpen(false);
        }}
      />
    </section>
  );
}
