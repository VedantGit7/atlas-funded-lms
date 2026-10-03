"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import type { ScoringProfileDto } from "@atlas/contracts/competency/competency-config.types";
import {
  createScoringProfile,
  formatCompetencyConfigApiError,
  updateScoringProfile,
} from "@/modules/competency/competency-config.api-client";
import {
  alertErrorClassName,
  fieldClassName,
  formatProfileSubtitle,
  labelClassName,
  monoClassName,
  outlineButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
  profileRowBaseClassName,
  profileRowSelectedClassName,
  profileStatusLabel,
  statusActiveBadgeClassName,
  statusDraftBadgeClassName,
} from "../competency-admin-shared";

type ScoringProfileEditorProps = {
  profiles: ScoringProfileDto[];
  selectedProfileId: string | null;
  canCreate: boolean;
  canUpdate: boolean;
  onSelectProfile: (profileId: string) => void;
  onChanged: () => void;
};

export function ScoringProfileEditor({
  profiles,
  selectedProfileId,
  canCreate,
  canUpdate,
  onSelectProfile,
  onChanged,
}: ScoringProfileEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [renameTarget, setRenameTarget] = useState<ScoringProfileDto | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function onCreate() {
    setPending(true);
    setError(null);

    try {
      const created = await createScoringProfile({ key, name, status: "ACTIVE" });
      setKey("");
      setName("");
      setShowCreate(false);
      onSelectProfile(created.data.id);
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onRenameSubmit() {
    if (!renameTarget) return;
    const nextName = renameValue.trim();
    if (!nextName || nextName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }

    setPending(true);
    setError(null);

    try {
      await updateScoringProfile(renameTarget.id, { name: nextName });
      setRenameTarget(null);
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={panelClassName} aria-labelledby="scoring-profiles-heading">
      <div className={panelHeaderClassName}>
        <h2 id="scoring-profiles-heading" className={panelEyebrowClassName}>
          Scoring profiles
        </h2>
        {canCreate ? (
          <button
            type="button"
            className={outlineButtonClassName}
            onClick={() => {
              setShowCreate((current) => !current);
            }}
          >
            {showCreate ? "Close" : "New profile"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className={`${alertErrorClassName} mx-4 mt-4 sm:mx-5`} role="alert">
          {error}
        </div>
      ) : null}

      {showCreate && canCreate ? (
        <div
          className={`${panelBodyClassName} border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/50`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className={labelClassName}>Key</span>
              <input
                value={key}
                onChange={(event) => {
                  setKey(event.target.value);
                }}
                className={fieldClassName}
                placeholder="std_cert_01"
                disabled={pending}
              />
            </label>
            <label className="space-y-1">
              <span className={labelClassName}>Name</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                className={fieldClassName}
                placeholder="Standard certification"
                disabled={pending}
              />
            </label>
          </div>
          <button
            type="button"
            className={`${primaryButtonClassName} mt-3`}
            disabled={pending || !key.trim() || !name.trim()}
            onClick={() => {
              void onCreate();
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create profile
          </button>
        </div>
      ) : null}

      {profiles.length === 0 ? (
        <p className={`${panelBodyClassName} text-sm text-[var(--admin-on-surface-variant)]`}>
          No scoring profiles yet. Create one to configure bands and publish scoring config.
        </p>
      ) : (
        <div className="divide-y divide-[var(--admin-border)]">
          {profiles.map((profile) => {
            const selected = selectedProfileId === profile.id;
            const status = profileStatusLabel(profile);
            return (
              <div
                key={profile.id}
                className={`${profileRowBaseClassName} ${selected ? profileRowSelectedClassName : "border-l-4 border-l-transparent"}`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    onSelectProfile(profile.id);
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`${monoClassName} font-bold text-[var(--admin-primary)]`}>
                      {profile.key}
                    </span>
                    <span
                      className={
                        status === "Active" ? statusActiveBadgeClassName : statusDraftBadgeClassName
                      }
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--admin-on-surface)]">
                    {profile.name}
                  </p>
                  <p className="mt-0.5 text-[11px] italic text-[var(--admin-on-surface-variant)]">
                    {formatProfileSubtitle(profile)}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]"
                      disabled={pending}
                      onClick={() => {
                        setRenameTarget(profile);
                        setRenameValue(profile.name);
                      }}
                    >
                      Rename
                    </button>
                  ) : null}
                  {selected ? (
                    <CheckCircle2
                      className="h-5 w-5 text-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle className="h-5 w-5 text-[var(--admin-border)]" aria-hidden="true" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renameTarget ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close rename dialog"
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm"
            onClick={() => {
              if (!pending) setRenameTarget(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-profile-title"
            className="relative w-full max-w-md rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-2xl"
          >
            <h3
              id="rename-profile-title"
              className="text-lg font-bold text-[var(--admin-on-surface)]"
            >
              Rename profile
            </h3>
            <label className="mt-4 block space-y-1">
              <span className={labelClassName}>Display name</span>
              <input
                value={renameValue}
                onChange={(event) => {
                  setRenameValue(event.target.value);
                }}
                className={fieldClassName}
                disabled={pending}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={outlineButtonClassName}
                disabled={pending}
                onClick={() => {
                  setRenameTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={pending || !renameValue.trim()}
                onClick={() => {
                  void onRenameSubmit();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
