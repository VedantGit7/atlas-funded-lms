"use client";

import { useState } from "react";
import type { ScoringProfileDto } from "../../../server/competency/competency-config.types";
import {
  formatCompetencyConfigApiError,
  publishScoringConfig,
} from "../../../modules/competency/competency-config.api-client";

type ScoringPublishPanelProps = {
  profiles: ScoringProfileDto[];
  selectedProfileId: string | null;
  canPublish: boolean;
  onPublished: () => void;
};

export function ScoringPublishPanel({
  profiles,
  selectedProfileId,
  canPublish,
  onPublished,
}: ScoringPublishPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [comment, setComment] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;

  async function onPublish() {
    if (!selectedProfileId) return;

    setPending(true);
    setError(null);

    try {
      await publishScoringConfig(
        selectedProfileId,
        comment.trim() ? { comment: comment.trim() } : {},
      );
      setShowConfirm(false);
      setComment("");
      onPublished();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded border p-4">
      <header>
        <h2 className="font-medium">Publish scoring config</h2>
        <p className="text-sm opacity-80">
          Snapshot dimensions, bands, and signal sources into a versioned config.
        </p>
      </header>

      {error ? (
        <div role="alert" className="rounded border p-3 text-sm">
          {error}
        </div>
      ) : null}

      {selectedProfile ? (
        <p className="text-sm">
          Active version:{" "}
          {selectedProfile.activeVersion != null
            ? `v${String(selectedProfile.activeVersion)}`
            : "None"}
        </p>
      ) : (
        <p className="text-sm opacity-80">Select a scoring profile to publish.</p>
      )}

      {canPublish && selectedProfileId ? (
        <>
          <label className="block space-y-1">
            <span className="text-sm">Publish comment (optional)</span>
            <textarea
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
              }}
              className="min-h-20 w-full rounded border p-2"
              disabled={pending}
            />
          </label>
          <button
            type="button"
            className="rounded border px-3 py-2"
            disabled={pending}
            onClick={() => {
              setShowConfirm(true);
            }}
          >
            Publish config
          </button>
        </>
      ) : null}

      {showConfirm ? (
        <div role="dialog" aria-modal="true" className="space-y-3 rounded border p-4">
          <p>Publish a new scoring config version for this profile?</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border px-3 py-2"
              disabled={pending}
              onClick={() => {
                void onPublish();
              }}
            >
              Confirm publish
            </button>
            <button
              type="button"
              className="rounded border px-3 py-2"
              disabled={pending}
              onClick={() => {
                setShowConfirm(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
