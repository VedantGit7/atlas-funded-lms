"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import type { BillingLocationView } from "@atlas/domain-config/schemas/learner-billing";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { CurrencyDropdown } from "./CurrencyDropdown";
import { LocationDropdown } from "./LocationDropdown";
import { locationTitle } from "./location-options";

const DESCRIPTION_LIMIT = 150;
const LOCATIONS_HREF = "/admin/learner-billing/locations";

export function LocationAddPanel() {
  const router = useRouter();
  const [locationKey, setLocationKey] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = locationKey != null && currency.length === 3;

  async function onAdd() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await clientApi.post<{ data: BillingLocationView }>(
        "/api/v1/learner-billing/locations",
        {
          locationKey,
          title: locationTitle(locationKey),
          currency,
          description: description.trim() ? description.trim() : null,
        },
        "add-billing-location",
        { successMessage: "Location added." },
      );
      router.push(LOCATIONS_HREF);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not add the location. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <Link
          href={LOCATIONS_HREF}
          prefetch={false}
          className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
        >
          Locations
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        <span className="font-semibold text-[var(--admin-primary)]">Add New Location</span>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          Add New Location
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Sell your content to multiple geo-locations with their own currency and rates.
        </p>
      </header>

      <div className="max-w-xl space-y-5 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
        <LocationDropdown id="location-select" value={locationKey} onChange={setLocationKey} />
        <CurrencyDropdown id="location-currency" value={currency} onChange={setCurrency} />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="location-description" className="text-sm font-bold text-[var(--admin-on-surface)]">
              Description
            </label>
            <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
              {description.length}/{DESCRIPTION_LIMIT}
            </span>
          </div>
          <textarea
            id="location-description"
            value={description}
            maxLength={DESCRIPTION_LIMIT}
            rows={4}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            placeholder="Place your text"
            className="w-full resize-y rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_92%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => void onAdd()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Adding
              </>
            ) : (
              "Add location"
            )}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              router.push(LOCATIONS_HREF);
            }}
            className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
