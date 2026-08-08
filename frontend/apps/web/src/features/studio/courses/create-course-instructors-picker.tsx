"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Users } from "lucide-react";
import {
  DropdownField,
  dropdownFooterButtonClassName,
  dropdownFooterClassName,
  dropdownItemClassName,
  memberInitials,
} from "./admin-form-dropdown-shared";
import {
  AddNewMemberDialog,
  loadInstructorMembers,
  type InstructorMember,
} from "./create-course-add-member-dialog";
import { dropdownLabelClassName, fieldClassName, RequiredMark } from "./create-course-dialog-shared";

type CreateCourseInstructorsPickerProps = {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
};

export function CreateCourseInstructorsPicker({
  value,
  onChange,
  disabled = false,
}: CreateCourseInstructorsPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<InstructorMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const didAutoSelect = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const loaded = await loadInstructorMembers();
        if (!cancelled) {
          setMembers(loaded);
          if (!didAutoSelect.current && loaded.length > 0) {
            didAutoSelect.current = true;
            const first = loaded[0];
            if (first) {
              onChangeRef.current([first.membershipId]);
            }
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (member) =>
        member.displayName.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query),
    );
  }, [members, search]);

  const selectedMembers = members.filter((member) => value.includes(member.membershipId));

  const triggerLabel =
    selectedMembers.length === 0
      ? "Select instructors"
      : selectedMembers.map((member) => member.displayName).join(", ");

  function closeDropdown() {
    setOpen(false);
    setSearch("");
  }

  function toggleMember(membershipId: string) {
    onChange(
      value.includes(membershipId)
        ? value.filter((id) => id !== membershipId)
        : [...value, membershipId],
    );
  }

  function handleClear() {
    onChange([]);
    closeDropdown();
  }

  function handleMemberInvited(member: InstructorMember) {
    setMembers((current) => {
      if (current.some((item) => item.membershipId === member.membershipId)) {
        return current;
      }
      return [member, ...current];
    });
    onChange(
      value.includes(member.membershipId) ? value : [...value, member.membershipId],
    );
    closeDropdown();
  }

  return (
    <>
      <DropdownField
        label={
          <span className={dropdownLabelClassName}>
            Instructors
            <RequiredMark />
          </span>
        }
        labelId="new-course-instructors"
        open={open}
        disabled={disabled || loading}
        portalZIndex={85}
        panelRole="listbox"
        panelAriaLabel="Course instructors"
        onToggle={() => {
          if (disabled || loading) return;
          setOpen((current) => !current);
          if (open) setSearch("");
        }}
        leftIcon={<Users className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />}
        triggerContent={
          <span
            className={
              selectedMembers.length > 0
                ? "text-[var(--admin-on-surface)]"
                : "text-[var(--admin-on-surface-variant)]"
            }
          >
            {loading ? "Loading instructors…" : triggerLabel}
          </span>
        }
      >
          <div className="shrink-0 border-b border-[var(--admin-border)] p-2">
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Select instructors"
              className={`${fieldClassName} rounded-xl py-2 text-sm`}
              autoFocus
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {filteredMembers.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-[var(--admin-on-surface-variant)]">
                No instructors match your search.
              </p>
            ) : (
              filteredMembers.map((member) => {
                const checked = value.includes(member.membershipId);
                return (
                  <button
                    key={member.membershipId}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => {
                      toggleMember(member.membershipId);
                    }}
                    className={[
                      dropdownItemClassName,
                      "gap-3",
                      checked ? "bg-[var(--admin-surface-high)]" : "",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={checked}
                      tabIndex={-1}
                      className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-xs font-bold text-[var(--admin-on-primary-container)]">
                        {memberInitials(member.displayName, member.email)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-semibold text-[var(--admin-on-surface)]">
                        {member.displayName}
                      </span>
                      {member.email ? (
                        <span className="block truncate text-xs text-[var(--admin-on-surface-variant)]">
                          {member.email}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className={dropdownFooterClassName}>
            <button type="button" onClick={handleClear} className={dropdownFooterButtonClassName}>
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMemberOpen(true);
              }}
              className={`${dropdownFooterButtonClassName} inline-flex items-center gap-1`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create New
            </button>
          </div>
      </DropdownField>

      <AddNewMemberDialog
        open={addMemberOpen}
        onClose={() => {
          setAddMemberOpen(false);
        }}
        onMemberInvited={handleMemberInvited}
      />
    </>
  );
}
