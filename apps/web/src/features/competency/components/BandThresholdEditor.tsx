"use client";

import { useEffect, useState } from "react";
import type { CompetencyBandDto } from "../../../server/competency/competency-config.types";
import {
  formatCompetencyConfigApiError,
  listProfileBands,
  replaceProfileBands,
} from "../../../modules/competency/competency-config.api-client";

type BandThresholdEditorProps = {
  profileId: string | null;
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

const emptyDraft = (): BandDraft => ({
  key: "",
  label: "",
  minScore: "0",
  maxScore: "100",
  sortOrder: "0",
});

export function BandThresholdEditor({ profileId, canManage, onChanged }: BandThresholdEditorProps) {
  const [bands, setBands] = useState<BandDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) {
      setBands([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void listProfileBands(profileId)
      .then((response) => {
        if (cancelled) return;
        setBands(response.data.length > 0 ? response.data.map(toDraft) : [emptyDraft()]);
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
      current.map((band, bandIndex) => (bandIndex === index ? { ...band, ...patch } : band)),
    );
  }

  function addBand() {
    setBands((current) => [...current, emptyDraft()]);
  }

  function removeBand(index: number) {
    setBands((current) => current.filter((_, bandIndex) => bandIndex !== index));
  }

  async function onSave() {
    if (!profileId) return;

    setPending(true);
    setError(null);

    try {
      await replaceProfileBands(profileId, {
        bands: bands.map((band) => ({
          key: band.key.trim(),
          label: band.label.trim(),
          minScore: Number(band.minScore),
          maxScore: Number(band.maxScore),
          sortOrder: Number(band.sortOrder),
        })),
      });
      onChanged();
    } catch (err) {
      setError(formatCompetencyConfigApiError(err));
    } finally {
      setPending(false);
    }
  }

  if (!profileId) {
    return (
      <section className="space-y-4 rounded border p-4">
        <h2 className="font-medium">Band thresholds</h2>
        <p className="text-sm opacity-80">Select a scoring profile to configure bands.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded border p-4">
      <header>
        <h2 className="font-medium">Band thresholds</h2>
        <p className="text-sm opacity-80">Define non-overlapping score ranges from 0 to 100.</p>
      </header>

      {error ? (
        <div role="alert" className="rounded border p-3 text-sm">
          {error}
        </div>
      ) : null}

      {loading ? <p className="text-sm opacity-80">Loading bands…</p> : null}

      <div className="space-y-3">
        {bands.map((band, index) => (
          <div key={`${band.key}-${String(index)}`} className="grid gap-2 md:grid-cols-5">
            <input
              value={band.key}
              onChange={(event) => {
                updateBand(index, { key: event.target.value });
              }}
              className="rounded border p-2"
              placeholder="developing"
              disabled={pending || !canManage}
            />
            <input
              value={band.label}
              onChange={(event) => {
                updateBand(index, { label: event.target.value });
              }}
              className="rounded border p-2"
              placeholder="Developing"
              disabled={pending || !canManage}
            />
            <input
              value={band.minScore}
              onChange={(event) => {
                updateBand(index, { minScore: event.target.value });
              }}
              className="rounded border p-2"
              placeholder="0"
              disabled={pending || !canManage}
            />
            <input
              value={band.maxScore}
              onChange={(event) => {
                updateBand(index, { maxScore: event.target.value });
              }}
              className="rounded border p-2"
              placeholder="100"
              disabled={pending || !canManage}
            />
            <input
              value={band.sortOrder}
              onChange={(event) => {
                updateBand(index, { sortOrder: event.target.value });
              }}
              className="rounded border p-2"
              placeholder="0"
              disabled={pending || !canManage}
            />
            {canManage ? (
              <button
                type="button"
                className="rounded border px-2 py-1 md:col-span-5 md:w-fit"
                disabled={pending}
                onClick={() => {
                  removeBand(index);
                }}
              >
                Remove band
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border px-3 py-2"
            disabled={pending}
            onClick={addBand}
          >
            Add band
          </button>
          <button
            type="button"
            className="rounded border px-3 py-2"
            disabled={pending || bands.length === 0}
            onClick={() => {
              void onSave();
            }}
          >
            Save bands
          </button>
        </div>
      ) : null}
    </section>
  );
}
