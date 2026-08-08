"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  alertErrorClassName,
  alertInfoClassName,
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
} from "../gamification-admin-shared";
import { GamificationSelectField } from "./GamificationSelectField";

type HallOfFameConfig = {
  recognitionSpaceSlug: string;
  leaderboardKey: string;
};

type SpaceOption = { slug: string; name: string };

type LeaderboardOption = { key: string; name: string };

type HallOfFameConfigPanelProps = {
  leaderboards: LeaderboardOption[];
};

export function HallOfFameConfigPanel({ leaderboards }: HallOfFameConfigPanelProps) {
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [form, setForm] = useState<HallOfFameConfig>({
    recognitionSpaceSlug: "",
    leaderboardKey: "",
  });
  const [savedForm, setSavedForm] = useState<HallOfFameConfig>({
    recognitionSpaceSlug: "",
    leaderboardKey: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [configResponse, spacesResponse] = await Promise.all([
          clientApi.get<{ data: HallOfFameConfig }>("/api/v1/gamification/hall-of-fame"),
          clientApi.get<{ data: { items: Array<{ slug: string; name: string }> } }>(
            "/api/v1/spaces",
          ),
        ]);
        const config = {
          recognitionSpaceSlug: configResponse.data.recognitionSpaceSlug ?? "",
          leaderboardKey: configResponse.data.leaderboardKey ?? "",
        };
        setForm(config);
        setSavedForm(config);
        setSpaces(
          spacesResponse.data.items.map((space) => ({ slug: space.slug, name: space.name })),
        );
      } catch (caught) {
        if (caught instanceof ClientApiError) {
          setError(caught.message);
          setRequestId(caught.requestId);
        } else {
          setError("Failed to load Hall of Fame configuration.");
        }
      } finally {
        setLoaded(true);
      }
    }

    void load();
  }, []);

  const isDirty =
    form.recognitionSpaceSlug !== savedForm.recognitionSpaceSlug ||
    form.leaderboardKey !== savedForm.leaderboardKey;

  async function save() {
    setMessage(null);
    setError(null);
    setRequestId(null);
    setBusy(true);
    try {
      const response = await clientApi.put<{ data: HallOfFameConfig }>(
        "/api/v1/gamification/hall-of-fame",
        {
          recognitionSpaceSlug: form.recognitionSpaceSlug.trim() || null,
          leaderboardKey: form.leaderboardKey.trim() || null,
        },
        `hall-of-fame-config-${Date.now().toString()}`,
      );
      const config = {
        recognitionSpaceSlug: response.data.recognitionSpaceSlug ?? "",
        leaderboardKey: response.data.leaderboardKey ?? "",
      };
      setForm(config);
      setSavedForm(config);
      setMessage("Hall of Fame configuration saved.");
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setError(caught.message);
        setRequestId(caught.requestId);
      } else {
        setError("Failed to save Hall of Fame configuration.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <div>
          <p className={panelEyebrowClassName}>Recognition</p>
          <h2 className="font-semibold text-[var(--admin-on-surface)]">Hall of Fame</h2>
        </div>
        <Link
          href="/hall-of-fame"
          className={`${outlineButtonClassName} text-xs`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          View learner page
        </Link>
      </div>
      <div className={`${panelBodyClassName} space-y-4`}>
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          Connect a community recognition space and XP leaderboard to the learner Hall of Fame
          page.
        </p>

        {!loaded ? (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading configuration…</p>
        ) : (
          <>
            {message ? (
              <p className={alertInfoClassName} role="status">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className={alertErrorClassName} role="alert">
                {error}
                {requestId ? ` (Request ID: ${requestId})` : null}
              </p>
            ) : null}

            {spaces.length > 0 ? (
              <GamificationSelectField
                label="Recognition space"
                value={form.recognitionSpaceSlug}
                onChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    recognitionSpaceSlug: value,
                  }));
                }}
                options={[
                  { value: "", label: "None" },
                  ...spaces.map((space) => ({
                    value: space.slug,
                    label: `${space.name} (${space.slug})`,
                  })),
                ]}
              />
            ) : (
              <label className="block">
                <span className={labelClassName}>Recognition space</span>
                <input
                  className={`${fieldClassName} mt-1.5`}
                  value={form.recognitionSpaceSlug}
                  placeholder="recognition"
                  onChange={(e) => {
                    setForm((current) => ({
                      ...current,
                      recognitionSpaceSlug: e.target.value,
                    }));
                  }}
                />
              </label>
            )}

            <GamificationSelectField
              label="Leaderboard"
              value={form.leaderboardKey}
              onChange={(value) => {
                setForm((current) => ({ ...current, leaderboardKey: value }));
              }}
              options={[
                { value: "", label: "None" },
                ...leaderboards.map((board) => ({
                  value: board.key,
                  label: `${board.name} (${board.key})`,
                })),
              ]}
            />

            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy || !isDirty}
              onClick={() => {
                void save();
              }}
            >
              {busy ? "Saving…" : "Save Hall of Fame settings"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
