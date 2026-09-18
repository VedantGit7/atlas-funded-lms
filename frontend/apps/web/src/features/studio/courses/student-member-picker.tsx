"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  DropdownField,
  dropdownFooterButtonClassName,
  dropdownFooterClassName,
  dropdownItemClassName,
} from "./admin-form-dropdown-shared";
import {
  AddNewMemberDialog,
  loadInstructorMembers,
  type InstructorMember,
} from "./create-course-add-member-dialog";
import {
  dropdownLabelClassName,
  fieldClassName,
  RequiredMark,
} from "./create-course-dialog-shared";

type StudentMemberPickerProps = {
  value: string | null;
  onChange: (membershipId: string | null) => void;
  onMemberCreated?: (member: InstructorMember) => void | Promise<void>;
  disabled?: boolean;
};

export function StudentMemberPicker({
  value,
  onChange,
  onMemberCreated,
  disabled = false,
}: StudentMemberPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<InstructorMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const loaded = await loadInstructorMembers();
        if (!cancelled) {
          setMembers(loaded);
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

  const selectedMember = members.find((member) => member.membershipId === value) ?? null;

  function closeDropdown() {
    setOpen(false);
    setSearch("");
  }

  function handleClear() {
    onChange(null);
    closeDropdown();
  }

  async function handleMemberInvited(member: InstructorMember) {
    setMembers((current) => {
      if (current.some((item) => item.membershipId === member.membershipId)) {
        return current;
      }
      return [member, ...current];
    });
    onChange(member.membershipId);
    setAddMemberOpen(false);
    closeDropdown();
    await onMemberCreated?.(member);
  }

  return (
    <>
      <DropdownField
        label={
          <span className={dropdownLabelClassName}>
            Student
            <RequiredMark />
          </span>
        }
        labelId="enroll-student-picker"
        open={open}
        disabled={disabled || loading}
        portalZIndex={90}
        panelRole="listbox"
        panelAriaLabel="Students"
        onToggle={() => {
          if (disabled || loading) return;
          setOpen((current) => !current);
          if (open) setSearch("");
        }}
        triggerContent={
          <span
            className={
              selectedMember
                ? "text-[var(--admin-on-surface)]"
                : "text-[var(--admin-on-surface-variant)]"
            }
          >
            {loading
              ? "Loading students…"
              : selectedMember
                ? selectedMember.email || selectedMember.displayName
                : "Select a student"}
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
            placeholder="Search by name or email"
            className={`${fieldClassName} rounded-xl py-2 text-sm`}
            autoFocus
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {filteredMembers.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-[var(--admin-on-surface-variant)]">
              No students match your search.
            </p>
          ) : (
            filteredMembers.map((member) => {
              const active = value === member.membershipId;
              return (
                <button
                  key={member.membershipId}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(member.membershipId);
                    closeDropdown();
                  }}
                  className={[
                    dropdownItemClassName,
                    "flex-col items-start gap-0.5 py-2.5",
                    active ? "bg-[var(--admin-surface-high)]" : "",
                  ].join(" ")}
                >
                  <span className="truncate font-medium text-[var(--admin-on-surface)]">
                    {member.email || member.displayName}
                  </span>
                  {member.displayName && member.email ? (
                    <span className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                      {member.displayName}
                    </span>
                  ) : null}
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
        defaultRoleKey="learner"
        onClose={() => {
          setAddMemberOpen(false);
        }}
        onMemberInvited={handleMemberInvited}
      />
    </>
  );
}
