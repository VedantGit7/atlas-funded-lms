"use client";

import { useState } from "react";
import { Info, Rocket, Upload } from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import type { ScoringProfileDto } from "@atlas/contracts/competency/competency-config.types";
import {
  formatCompetencyConfigApiError,
  publishScoringConfig,
} from "@atlas/contracts-modules/competency/competency-config.api-client";
import {
  alertErrorClassName,
  alertInfoClassName,
  fieldClassName,
  labelClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
} from "../competency-admin-shared";

type ScoringPublishPanelProps = {
  profiles: ScoringProfileDto[];
  selectedProfileId: string | null;
  dimensionCount: number;
  bandCount: number;
  canPublish: boolean;
  onPublished: () => void;
};

export function ScoringPublishPanel({
  profiles,
  selectedProfileId,
  dimensionCount,
  bandCount,
  canPublish,
  onPublished,
}: ScoringPublishPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [comment, setComment] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const nextVersion =
    selectedProfile?.activeVersion != null ? selectedProfile.activeVersion + 1 : 1;

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
    <>
      <section className={panelClassName} aria-labelledby="publish-heading">
        <div className={`${panelHeaderClassName} gap-2`}>
          <Rocket className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
          <h2 id="publish-heading" className={panelEyebrowClassName}>
            Publish
          </h2>
        </div>

        <div className={`${panelBodyClassName} space-y-4`}>
          {error ? (
            <div className={alertErrorClassName} role="alert">
              {error}
            </div>
          ) : null}

          {selectedProfile ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Active version:{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {selectedProfile.activeVersion != null
                  ? `v${String(selectedProfile.activeVersion)}`
                  : "None published yet"}
              </span>
            </p>
          ) : (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Select a scoring profile to publish configuration.
            </p>
          )}

          {canPublish && selectedProfileId ? (
            <>
              <label className="block space-y-1">
                <span className={labelClassName}>Describe this change</span>
                <textarea
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                  }}
                  className={`${fieldClassName} min-h-24 resize-none`}
                  placeholder="Explain the rationale for this scoring update…"
                  disabled={pending}
                  rows={3}
                />
              </label>

              <button
                type="button"
                className={`${primaryButtonClassName} w-full py-3`}
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setShowConfirm(true);
                }}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Publish configuration
              </button>

              <p className="text-center text-[11px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                Publishing snapshots dimensions, bands, and signal sources into a versioned config.
                Existing signal history is not modified.
              </p>
            </>
          ) : null}
        </div>
      </section>

      <AdminConfirmDialog
        open={showConfirm}
        title="Review configuration changes"
        description={
          <div className="space-y-4 text-left">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                Summary
              </p>
              <ul className="space-y-2 text-sm text-[var(--admin-on-surface)]">
                <li className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
                  Profile:{" "}
                  <span className="font-semibold">{selectedProfile?.name ?? "—"}</span>
                </li>
                <li className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
                  {dimensionCount} dimension{dimensionCount === 1 ? "" : "s"} · {bandCount} band
                  {bandCount === 1 ? "" : "s"}
                </li>
                <li className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
                  New version:{" "}
                  <span className="font-mono font-semibold">v{String(nextVersion)}</span>
                </li>
              </ul>
            </div>
            {comment.trim() ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  Publish comment
                </p>
                <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-sm">
                  {comment.trim()}
                </p>
              </div>
            ) : null}
            <div className={alertInfoClassName}>
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
              <span>Publishing applies to new competency evaluations using this profile.</span>
            </div>
          </div>
        }
        confirmLabel="Confirm & publish"
        busyLabel="Publishing…"
        icon={Upload}
        tone="primary"
        busy={pending}
        error={showConfirm ? error : null}
        onConfirm={() => {
          void onPublish();
        }}
        onCancel={() => {
          if (!pending) {
            setShowConfirm(false);
            setError(null);
          }
        }}
      />
    </>
  );
}
