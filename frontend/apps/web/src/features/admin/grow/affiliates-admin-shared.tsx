"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { clientApi } from "../../../lib/client-api";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  pctInputValue,
  statCardSurfaceClassName,
  type AffiliateProduct,
  type MemberSearchOption,
} from "./affiliates-shared";

export const DEFAULT_CURRENCY = "USD";

export function ToggleSwitch(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.ariaLabel}
      disabled={props.disabled}
      onClick={() => {
        props.onChange(!props.checked);
      }}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
        props.checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-[var(--admin-surface)] transition-transform duration-200",
          props.checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
        aria-hidden="true"
      />
    </button>
  );
}

export function StatCard(props: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className={statCardSurfaceClassName()}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
        {props.value}
      </p>
      {props.hint ? (
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{props.hint}</p>
      ) : null}
    </div>
  );
}

export function Badge(props: { className: string; children: ReactNode }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        props.className,
      ].join(" ")}
    >
      {props.children}
    </span>
  );
}

export type ProductRowDraft = {
  enabled: boolean;
  standardDiscountPct: string;
  standardCommissionPct: string;
  premiumDiscountPct: string;
  premiumCommissionPct: string;
};

export function productToDraft(
  product: AffiliateProduct | null,
  enabledDefault: boolean,
): ProductRowDraft {
  return {
    enabled: product?.enabled ?? enabledDefault,
    standardDiscountPct: pctInputValue(product?.standardDiscountPct),
    standardCommissionPct: pctInputValue(product?.standardCommissionPct),
    premiumDiscountPct: pctInputValue(product?.premiumDiscountPct),
    premiumCommissionPct: pctInputValue(product?.premiumCommissionPct),
  };
}

export function MemberSearchField(props: {
  id: string;
  label: string;
  value: MemberSearchOption | null;
  onChange: (member: MemberSearchOption | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (props.value) {
      setQuery(props.value.label);
    }
  }, [props.value]);

  async function search(term: string) {
    setQuery(term);
    if (props.value && term !== props.value.label) {
      props.onChange(null);
    }
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await clientApi.get<{
        data: {
          items: Array<{
            id: string;
            invitedEmail: string | null;
            profile: { displayName: string | null } | null;
          }>;
        };
      }>(`/api/v1/members?search=${encodeURIComponent(term.trim())}&limit=10&status=ACTIVE`);
      setResults(
        response.data.items.map((member) => ({
          id: member.id,
          label: member.profile?.displayName ?? member.invitedEmail ?? member.id,
          email: member.invitedEmail,
        })),
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className={MESSENGER_WIZARD_LABEL_CLASS}>
        {props.label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <input
          id={props.id}
          value={query}
          disabled={props.disabled}
          placeholder="Search by name or email…"
          onChange={(event) => {
            void search(event.target.value);
          }}
          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 pl-9`}
        />
      </div>
      {searching ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">Searching…</p>
      ) : null}
      {results.length > 0 && !props.value ? (
        <ul className="max-h-48 overflow-y-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 shadow-sm">
          {results.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-high)]"
                onClick={() => {
                  props.onChange(member);
                  setQuery(member.label);
                  setResults([]);
                }}
              >
                <span className="font-medium text-[var(--admin-on-surface)]">{member.label}</span>
                {member.email ? (
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">
                    {member.email}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {props.value ? (
        <p className="text-xs text-[var(--admin-success)]">
          Selected: {props.value.label}
          {props.value.email ? ` (${props.value.email})` : ""}
        </p>
      ) : null}
    </div>
  );
}

/** Removing a saved value is explicit; an empty field otherwise keeps it (audit M6). */
export function PayoutClearToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {label}
    </label>
  );
}
