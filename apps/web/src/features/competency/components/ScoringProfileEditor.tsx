"use client";

import { useState } from "react";
import type { ScoringProfileDto } from "../../../server/competency/competency-config.types";
import {
  createScoringProfile,
  formatCompetencyConfigApiError,
  updateScoringProfile,
} from "../../../modules/competency/competency-config.api-client";

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
  const [key, setKey] = useState("");
  const [name, setName] = useState("");

  async function onCreate() {
    setPending(true);
    setError(null);

    try {
      const created = await createScoringProfile({ key, name, status: "ACTIVE" });
      setKey("");
      setName("");
      onSelectProfile(created.data.id);
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onRename(profile: ScoringProfileDto) {
    const nextName = window.prompt("Profile name", profile.name);
    if (!nextName || nextName.trim() === profile.name) return;

    setPending(true);
    setError(null);

    try {
      await updateScoringProfile(profile.id, { name: nextName.trim() });
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded border p-4">
      <header>
        <h2 className="font-medium">Scoring profiles</h2>
        <p className="text-sm opacity-80">Create and select a profile to configure bands.</p>
      </header>

      {error ? (
        <div role="alert" className="rounded border p-3 text-sm">
          {error}
        </div>
      ) : null}

      {profiles.length === 0 ? (
        <p className="text-sm opacity-80">No scoring profiles yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {profiles.map((profile) => (
            <li key={profile.id} className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className={`text-left ${selectedProfileId === profile.id ? "font-semibold" : ""}`}
                onClick={() => {
                  onSelectProfile(profile.id);
                }}
              >
                {profile.name} ({profile.key})
                {profile.activeVersion != null ? (
                  <span className="ml-2 opacity-70">{`v${String(profile.activeVersion)}`}</span>
                ) : null}
              </button>
              {canUpdate ? (
                <button
                  type="button"
                  className="rounded border px-2 py-1"
                  disabled={pending}
                  onClick={() => {
                    void onRename(profile);
                  }}
                >
                  Edit
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm">Key</span>
            <input
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
              }}
              className="w-full rounded border p-2"
              placeholder="default_profile"
              disabled={pending}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Name</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="w-full rounded border p-2"
              placeholder="Default profile"
              disabled={pending}
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="button"
              className="rounded border px-3 py-2"
              disabled={pending || !key.trim() || !name.trim()}
              onClick={() => {
                void onCreate();
              }}
            >
              Create profile
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
