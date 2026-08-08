"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { clientApi } from "../../../lib/client-api";
import { fieldClassName, labelClassName, dropdownPanelSurfaceClassName } from "../gamification-admin-shared";

export type MemberOption = { id: string; label: string };

type MemberMultiSearchSelectProps = {
  selected: MemberOption[];
  onChange: (members: MemberOption[]) => void;
  initialOptions: MemberOption[];
};

export function MemberMultiSearchSelect({
  selected,
  onChange,
  initialOptions,
}: MemberMultiSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberOption[]>(initialOptions);
  const [searching, setSearching] = useState(false);

  const selectedIds = new Set(selected.map((member) => member.id));

  async function search(term: string) {
    setQuery(term);
    if (!term.trim()) {
      setResults(initialOptions);
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
        })),
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function toggleMember(member: MemberOption) {
    if (selectedIds.has(member.id)) {
      onChange(selected.filter((entry) => entry.id !== member.id));
    } else {
      onChange([...selected, member]);
    }
  }

  function removeMember(memberId: string) {
    onChange(selected.filter((entry) => entry.id !== memberId));
  }

  return (
    <div className="mt-1.5 space-y-2">
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((member) => (
            <li
              key={member.id}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2.5 py-1 text-xs text-[var(--admin-on-surface)]"
            >
              {member.label}
              <button
                type="button"
                className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                aria-label={`Remove ${member.label}`}
                onClick={() => {
                  removeMember(member.id);
                }}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">No members selected.</p>
      )}

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
          aria-hidden="true"
        />
        <input
          className={`${fieldClassName} pl-9`}
          value={query}
          placeholder="Search members to add…"
          onChange={(e) => {
            void search(e.target.value);
          }}
        />
      </div>

      {searching ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">Searching…</p>
      ) : null}

      {results.length > 0 ? (
        <fieldset>
          <legend className={labelClassName}>Search results</legend>
          <ul className={`mt-1.5 max-h-48 overflow-y-auto ${dropdownPanelSurfaceClassName}`}>
            {results.map((member) => (
              <li key={member.id} className="border-b border-[var(--admin-border)] last:border-b-0">
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--admin-surface-low)]">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(member.id)}
                    onChange={() => {
                      toggleMember(member);
                    }}
                  />
                  <span className="text-[var(--admin-on-surface)]">{member.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : query.trim() ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">No matching active members.</p>
      ) : null}
    </div>
  );
}
