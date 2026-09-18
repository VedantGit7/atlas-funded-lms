"use client";

import { useId, useState, useEffect } from "react";
import { Radio, Calendar, Link as LinkIcon } from "lucide-react";
import type { z } from "zod";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import { inlineLessonPrimaryDarkButtonClassName } from "./inline-lesson-editor-shared";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LiveConfig = {
  meetingUrl: string;
  scheduledAt: string;
  provider: "custom" | "zoom" | "teams";
  instructions: string;
};

type LessonLiveWorkspaceProps = {
  lesson: StudioLessonDetail;
  editable: boolean;
  onSaved?: () => void;
};

function readLiveConfig(content: unknown): LiveConfig {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return {
      meetingUrl: "",
      scheduledAt: "",
      provider: "custom",
      instructions: "",
    };
  }

  const contentObj = content as Record<string, unknown>;
  const live = contentObj["live"];

  if (!live || typeof live !== "object" || Array.isArray(live)) {
    return {
      meetingUrl: "",
      scheduledAt: "",
      provider: "custom",
      instructions: "",
    };
  }

  const liveObj = live as Record<string, unknown>;

  return {
    meetingUrl: typeof liveObj["meetingUrl"] === "string" ? liveObj["meetingUrl"] : "",
    scheduledAt: typeof liveObj["scheduledAt"] === "string" ? liveObj["scheduledAt"] : "",
    provider:
      liveObj["provider"] === "zoom" || liveObj["provider"] === "teams"
        ? liveObj["provider"]
        : "custom",
    instructions: typeof liveObj["instructions"] === "string" ? liveObj["instructions"] : "",
  };
}

export function LessonLiveWorkspace({ lesson, editable, onSaved }: LessonLiveWorkspaceProps) {
  const meetingUrlId = useId();
  const scheduledAtId = useId();
  const providerId = useId();
  const instructionsId = useId();

  const [config, setConfig] = useState<LiveConfig>(() => readLiveConfig(lesson.content));
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(readLiveConfig(lesson.content));
    setShowForm(Boolean(readLiveConfig(lesson.content).meetingUrl));
  }, [lesson.content]);

  async function handleSave() {
    if (!editable || saving) return;

    if (!config.meetingUrl.trim()) {
      setError("Meeting URL is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await clientApi.put(
        `/api/v1/lessons/${lesson.id}`,
        {
          content: {
            live: {
              meetingUrl: config.meetingUrl.trim() || null,
              scheduledAt: config.scheduledAt.trim() || null,
              provider: config.provider,
              instructions: config.instructions.trim() || null,
            },
          },
        },
        "lesson-live-config-save",
      );

      onSaved?.();
      setShowForm(false);
    } catch (saveError) {
      if (saveError instanceof ClientApiError) {
        setError(saveError.message);
      } else {
        setError("Failed to save live configuration");
      }
    } finally {
      setSaving(false);
    }
  }

  if (showForm) {
    return (
      <section className="flex min-h-[min(28rem,calc(100vh-14rem))] flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <header className="border-b border-[var(--admin-border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
            Configure live class
          </h2>
        </header>

        {error ? (
          <div className="border-b border-[var(--admin-danger)]/25 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-5 py-2 text-sm text-[var(--admin-danger)]">
            {error}
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-6 p-5">
          <div>
            <label
              htmlFor={meetingUrlId}
              className="mb-2 block text-sm font-medium text-[var(--admin-on-surface)]"
            >
              Meeting URL <span className="text-[var(--admin-danger)]">*</span>
            </label>
            <div className="relative">
              <LinkIcon
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                id={meetingUrlId}
                type="url"
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2.5 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                placeholder="https://zoom.us/j/123456789"
                value={config.meetingUrl}
                disabled={!editable || saving}
                onChange={(event) => {
                  setConfig((prev) => ({ ...prev, meetingUrl: event.target.value }));
                  setError(null);
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={scheduledAtId}
              className="mb-2 block text-sm font-medium text-[var(--admin-on-surface)]"
            >
              Scheduled date and time
            </label>
            <div className="relative">
              <Calendar
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                id={scheduledAtId}
                type="datetime-local"
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2.5 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                value={config.scheduledAt}
                disabled={!editable || saving}
                onChange={(event) => {
                  setConfig((prev) => ({ ...prev, scheduledAt: event.target.value }));
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={providerId}
              className="mb-2 block text-sm font-medium text-[var(--admin-on-surface)]"
            >
              Platform
            </label>
            <select
              id={providerId}
              className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              value={config.provider}
              disabled={!editable || saving}
              onChange={(event) => {
                setConfig((prev) => ({
                  ...prev,
                  provider: event.target.value as LiveConfig["provider"],
                }));
              }}
            >
              <option value="custom">Custom link</option>
              <option value="zoom">Zoom</option>
              <option value="teams">Microsoft Teams</option>
            </select>
          </div>

          <div>
            <label
              htmlFor={instructionsId}
              className="mb-2 block text-sm font-medium text-[var(--admin-on-surface)]"
            >
              Instructions for learners
            </label>
            <textarea
              id={instructionsId}
              className="min-h-[8rem] w-full resize-y rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              placeholder="Add any special instructions or requirements for joining the live session..."
              value={config.instructions}
              disabled={!editable || saving}
              onChange={(event) => {
                setConfig((prev) => ({ ...prev, instructions: event.target.value }));
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={inlineLessonPrimaryDarkButtonClassName}
              disabled={!editable || saving}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
              disabled={saving}
              onClick={() => {
                setShowForm(false);
                setConfig(readLiveConfig(lesson.content));
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[min(28rem,calc(100vh-14rem))] flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <header className="border-b border-[var(--admin-border)] px-5 py-4">
        <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
          Configure live class
        </h2>
      </header>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface-low))] px-6 py-12 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-[var(--admin-danger)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]">
            <span
              className="h-2 w-2 rounded-full bg-[var(--admin-on-primary)]"
              aria-hidden="true"
            />
            Live
          </div>
          <h3 className="text-lg font-semibold text-[var(--admin-on-surface)]">
            Host an online live session
          </h3>
          <p className="mt-2 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Configure your live class now and start teaching.
          </p>
          <button
            type="button"
            className={`${inlineLessonPrimaryDarkButtonClassName} mt-8`}
            disabled={!editable}
            onClick={() => {
              setShowForm(true);
            }}
          >
            <Radio className="h-4 w-4" aria-hidden="true" />
            Configure
          </button>
        </div>
      </div>
    </section>
  );
}
