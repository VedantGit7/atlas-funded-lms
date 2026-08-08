"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CompetencyBandDto } from "@atlas/contracts/competency/competency-config.types";
import {
  formatCompetencyConfigApiError,
  listProfileBands,
  replaceProfileBands,
} from "@atlas/contracts-modules/competency/competency-config.api-client";
import {
  alertErrorClassName,
  outlineButtonClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
  slugifyBandKey,
  tableHeadClassName,
  tableInputClassName,
  tableMonoInputClassName,
} from "../competency-admin-shared";

type BandThresholdEditorProps = {
  profileId: string | null;
  profileName: string | null;
  canManage: boolean;
  onChanged: () => void;
};

type BandDraft = {
  key: string;
  label: string;
  minScore: string;
  maxScore: string;
  sortOrder: string;
};

function toDraft(band: CompetencyBandDto): BandDraft {
  return {
    key: band.key,
    label: band.label,
    minScore: String(band.minScore),
    maxScore: String(band.maxScore),
    sortOrder: String(band.sortOrder),
  };
}

function serializeBands(bands: BandDraft[]): string {
  return JSON.stringify(bands);
}

const emptyDraft = (sortOrder: number): BandDraft => ({
  key: "",
  label: "",
  minScore: "0",
  maxScore: "100",
  sortOrder: String(sortOrder),
});

export function BandThresholdEditor({
  profileId,
  profileName,
  canManage,
  onChanged,
}: BandThresholdEditorProps) {
  const [bands, setBands] = useState<BandDraft[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDirty = useMemo(
    () => bands.length > 0 && serializeBands(bands) !== savedSnapshot,
    [bands, savedSnapshot],
  );

  useEffect(() => {
    if (!profileId) {
      setBands([]);
      setSavedSnapshot("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void listProfileBands(profileId)
      .then((response) => {
        if (cancelled) return;
        const next = response.data.length > 0 ? response.data.map(toDraft) : [emptyDraft(0)];
        setBands(next);
        setSavedSnapshot(serializeBands(next));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(formatCompetencyConfigApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  function updateBand(index: number, patch: Partial<BandDraft>) {
    setBands((current) =>
      current.map((band, bandIndex) => {
        if (bandIndex !== index) return band;
        const next = { ...band, ...patch };
        if (patch.label != null && (!band.key || band.key === slugifyBandKey(band.label))) {
          next.key = slugifyBandKey(patch.label);
        }
        return next;
      }),
    );
  }

  function addBand() {
    setBands((current) => [...current, emptyDraft(current.length)]);
  }

  function removeBand(index: number) {
    setBands((current) => current.filter((_, bandIndex) => bandIndex !== index));
  }

  async function onSave() {
    if (!profileId) return;

    setPending(true);
    setError(null);

    try {
      const payload = bands.map((band, index) => ({
        key: band.key.trim() || slugifyBandKey(band.label) || `band_${String(index)}`,
        label: band.label.trim(),
        minScore: Number(band.minScore),
        maxScore: Number(band.maxScore),
        sortOrder: Number(band.sortOrder || String(index)),
      }));

      const response = await replaceProfileBands(profileId, { bands: payload });
      const next = response.data.map(toDraft);
      setBands(next);
      setSavedSnapshot(serializeBands(next));
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  if (!profileId) {
    return (
      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <h2 className={panelEyebrowClassName}>Band thresholds</h2>
        </div>
        <p className="p-5 text-sm text-[var(--admin-on-surface-variant)]">
          Select a scoring profile to configure performance tiers.
        </p>
      </section>
    );
  }

  return (
    <section className={panelClassName} aria-labelledby="band-thresholds-heading">
      <div className={panelHeaderClassName}>
        <div>
          <h2 id="band-thresholds-heading" className={panelEyebrowClassName}>
            Band thresholds
          </h2>
          {profileName ? (
            <p className="mt-0.5 text-[11px] italic text-[var(--admin-on-surface-variant)]">
              Configure performance tiers for &ldquo;{profileName}&rdquo;
            </p>
          ) : null}
        </div>
        {canManage ? (
          <button
            type="button"
            className={`${outlineButtonClassName} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs`}
            disabled={pending}
            onClick={addBand}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add band
          </button>
        ) : null}
      </div>

      {error ? (
        <div className={`${alertErrorClassName} mx-4 mt-4 sm:mx-5`} role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="p-5 text-sm text-[var(--admin-on-surface-variant)]">Loading bands…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <caption className="sr-only">Score band thresholds</caption>
              <thead>
                <tr className={`${tableHeadClassName} border-b border-[var(--admin-border)]`}>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Label
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Min score
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Max score
                  </th>
                  {canManage ? (
                    <th scope="col" className="px-4 py-3 text-right sm:px-5">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {bands.map((band, index) => (
                  <tr
                    key={`${band.key}-${String(index)}`}
                    className="group transition-colors hover:bg-[var(--admin-surface-low)]"
                  >
                    <td className="px-4 py-2 sm:px-5">
                      <input
                        value={band.label}
                        onChange={(event) => {
                          updateBand(index, { label: event.target.value });
                        }}
                        className={tableInputClassName}
                        placeholder="Professional"
                        disabled={pending || !canManage}
                        aria-label={`Band ${String(index + 1)} label`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={band.minScore}
                        onChange={(event) => {
                          updateBand(index, { minScore: event.target.value });
                        }}
                        className={`${tableMonoInputClassName} w-24`}
                        type="number"
                        min={0}
                        max={100}
                        disabled={pending || !canManage}
                        aria-label={`Band ${String(index + 1)} minimum score`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={band.maxScore}
                        onChange={(event) => {
                          updateBand(index, { maxScore: event.target.value });
                        }}
                        className={`${tableMonoInputClassName} w-24`}
                        type="number"
                        min={0}
                        max={100}
                        disabled={pending || !canManage}
                        aria-label={`Band ${String(index + 1)} maximum score`}
                      />
                    </td>
                    {canManage ? (
                      <td className="px-4 py-2 text-right sm:px-5">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)] disabled:opacity-50"
                          disabled={pending || bands.length <= 1}
                          aria-label={`Remove band ${band.label || String(index + 1)}`}
                          onClick={() => {
                            removeBand(index);
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManage ? (
            <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-3 sm:px-5">
              <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                {isDirty ? "Unsaved band changes" : "All band changes saved"}
              </p>
              <button
                type="button"
                className={
                  isDirty
                    ? primaryButtonClassName
                    : `${outlineButtonClassName} cursor-not-allowed opacity-60`
                }
                disabled={pending || !isDirty || bands.length === 0}
                onClick={() => {
                  void onSave();
                }}
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
