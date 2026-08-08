"use client";

import { useEffect, useState } from "react";
import { Eye, Plus } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  alertErrorClassName,
  fieldClassName,
  inlineExpandClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../gamification-admin-shared";
import { GamificationSelectField } from "./GamificationSelectField";

export type LeaderboardDefinition = {
  id: string;
  key: string;
  name: string;
  metricKey: "xp_total";
  windowKey: "all_time" | "weekly" | "monthly";
  config: {
    scopeType: "tenant" | "course" | "group";
    courseId?: string | undefined;
    spaceId?: string | undefined;
    privacyMode: "anonymous_rank";
    maxEntries: number;
  };
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
};

export type CourseOption = { id: string; title: string };

type LeaderboardFormState = {
  key: string;
  name: string;
  windowKey: LeaderboardDefinition["windowKey"];
  scopeType: "tenant" | "course" | "group";
  courseId: string;
  spaceId: string;
  maxEntries: number;
  status: LeaderboardDefinition["status"];
};

type SpaceOption = { id: string; slug: string; name: string };

type LeaderboardPreview = {
  periodKey: string;
  calculatedAt: string;
  entries: Array<{ rank: number; label: string; metricValue: number; isSelf: boolean }>;
};

function stateFromDefinition(definition: LeaderboardDefinition | null): LeaderboardFormState {
  return {
    key: definition?.key ?? "",
    name: definition?.name ?? "",
    windowKey: definition?.windowKey ?? "all_time",
    scopeType: definition?.config.scopeType ?? "tenant",
    courseId: definition?.config.courseId ?? "",
    spaceId: definition?.config.spaceId ?? "",
    maxEntries: definition?.config.maxEntries ?? 10,
    status: definition?.status ?? "ACTIVE",
  };
}

type LeaderboardConfigFormProps = {
  mode: "create" | "edit";
  definition: LeaderboardDefinition | null;
  courses: CourseOption[];
  onSaved: (definition: LeaderboardDefinition) => void;
};

export function LeaderboardConfigForm({
  mode,
  definition,
  courses,
  onSaved,
}: LeaderboardConfigFormProps) {
  const [form, setForm] = useState<LeaderboardFormState>(() => stateFromDefinition(definition));
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<LeaderboardPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const courseScopeInvalid = form.scopeType === "course" && !form.courseId;
  const groupScopeInvalid = form.scopeType === "group" && !form.spaceId;
  const submitDisabled =
    busy || !form.key.trim() || !form.name.trim() || courseScopeInvalid || groupScopeInvalid;

  useEffect(() => {
    async function loadSpaces() {
      try {
        const response = await clientApi.get<{
          data: { items: Array<{ id: string; slug: string; name: string }> };
        }>("/api/v1/spaces");
        setSpaces(response.data.items);
      } catch {
        setSpaces([]);
      }
    }

    void loadSpaces();
  }, []);

  function patch(partial: Partial<LeaderboardFormState>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function buildConfig() {
    return {
      scopeType: form.scopeType,
      ...(form.scopeType === "course" ? { courseId: form.courseId } : {}),
      ...(form.scopeType === "group" ? { spaceId: form.spaceId } : {}),
      privacyMode: "anonymous_rank" as const,
      maxEntries: form.maxEntries,
    };
  }

  async function save() {
    setError(null);
    setRequestId(null);
    setBusy(true);
    try {
      if (mode === "create") {
        const response = await clientApi.post<{ data: LeaderboardDefinition }>(
          "/api/v1/leaderboards",
          {
            operation: "create",
            leaderboard: {
              key: form.key.trim(),
              name: form.name.trim(),
              metricKey: "xp_total",
              windowKey: form.windowKey,
              config: buildConfig(),
              status: form.status,
            },
          },
          `leaderboard-create-${form.key.trim()}`,
        );
        onSaved(response.data);
        setForm(stateFromDefinition(null));
      } else if (definition) {
        const response = await clientApi.put<{ data: LeaderboardDefinition }>(
          "/api/v1/leaderboards",
          {
            id: definition.id,
            name: form.name.trim(),
            windowKey: form.windowKey,
            config: buildConfig(),
            status: form.status,
          },
          `leaderboard-update-${definition.id}`,
        );
        onSaved(response.data);
      }
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setError(caught.message);
        setRequestId(caught.requestId);
      } else {
        setError("Failed to save leaderboard.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview() {
    if (!definition) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const response = await clientApi.get<{ data: LeaderboardPreview }>(
        `/api/v1/leaderboards/${definition.id}`,
      );
      setPreview(response.data);
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setError(caught.message);
        setRequestId(caught.requestId);
      } else {
        setError("Failed to load preview.");
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className={alertErrorClassName} role="alert">
          {error}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClassName}>Key</span>
          <input
            className={`${fieldClassName} mt-1.5`}
            value={form.key}
            disabled={mode === "edit"}
            placeholder="weekly-xp"
            onChange={(e) => {
              patch({ key: e.target.value });
            }}
          />
        </label>
        <label className="block">
          <span className={labelClassName}>Name</span>
          <input
            className={`${fieldClassName} mt-1.5`}
            value={form.name}
            placeholder="Weekly XP"
            onChange={(e) => {
              patch({ name: e.target.value });
            }}
          />
        </label>
        <GamificationSelectField
          label="Window"
          value={form.windowKey}
          onChange={(value) => {
            patch({ windowKey: value as LeaderboardFormState["windowKey"] });
          }}
          options={[
            { value: "all_time", label: "All time" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]}
        />
        <GamificationSelectField
          label="Status"
          value={form.status}
          onChange={(value) => {
            patch({ status: value as LeaderboardFormState["status"] });
          }}
          options={[
            { value: "ACTIVE", label: "ACTIVE" },
            { value: "INACTIVE", label: "INACTIVE" },
            { value: "ARCHIVED", label: "ARCHIVED" },
          ]}
        />
        <GamificationSelectField
          label="Scope"
          value={form.scopeType}
          onChange={(value) => {
            patch({
              scopeType: value as "tenant" | "course" | "group",
              courseId: "",
              spaceId: "",
            });
          }}
          options={[
            { value: "tenant", label: "Whole academy" },
            { value: "course", label: "Single course" },
            { value: "group", label: "Community group" },
          ]}
        />
        {form.scopeType === "course" ? (
          <GamificationSelectField
            label="Course"
            value={form.courseId}
            onChange={(courseId) => {
              patch({ courseId });
            }}
            placeholder="Select a course…"
            options={[
              { value: "", label: "Select a course…" },
              ...courses.map((course) => ({
                value: course.id,
                label: course.title,
              })),
            ]}
          />
        ) : null}
        {form.scopeType === "group" ? (
          <GamificationSelectField
            label="Community space"
            value={form.spaceId}
            onChange={(spaceId) => {
              patch({ spaceId });
            }}
            placeholder="Select a space…"
            options={[
              { value: "", label: "Select a space…" },
              ...spaces.map((space) => ({
                value: space.id,
                label: `${space.name} (${space.slug})`,
              })),
            ]}
          />
        ) : null}
        <label className="block">
          <span className={labelClassName}>Max entries</span>
          <input
            type="number"
            min={1}
            max={100}
            className={`${fieldClassName} mt-1.5`}
            value={form.maxEntries}
            onChange={(e) => {
              patch({ maxEntries: Math.min(100, Math.max(1, Number(e.target.value) || 10)) });
            }}
          />
        </label>
        <div className="block">
          <span className={labelClassName}>Privacy</span>
          <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
            Anonymous rank — learners see “Rank N”, never names.
          </p>
        </div>
      </div>

      {courseScopeInvalid ? (
        <p className="text-sm text-[var(--admin-danger)]">
          Select a course for course-scoped leaderboards.
        </p>
      ) : null}
      {groupScopeInvalid ? (
        <p className="text-sm text-[var(--admin-danger)]">
          Select a community space for group-scoped leaderboards.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={submitDisabled}
          onClick={() => void save()}
        >
          {mode === "create" ? <Plus className="h-4 w-4" aria-hidden="true" /> : null}
          {mode === "create" ? "Create leaderboard" : "Save leaderboard"}
        </button>
        {mode === "edit" && definition ? (
          <button
            type="button"
            className={outlineButtonClassName}
            disabled={previewLoading}
            onClick={() => void loadPreview()}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {previewLoading ? "Loading preview…" : "Preview standings"}
          </button>
        ) : null}
      </div>

      {preview ? (
        <div
          className={`rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 ${inlineExpandClassName}`}
        >
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Period {preview.periodKey} · calculated{" "}
            {new Date(preview.calculatedAt).toLocaleString()}
          </p>
          {preview.entries.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">No entries yet.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] text-left text-[var(--admin-on-surface-variant)]">
                  <th className="py-1.5 pr-3 font-medium">Rank</th>
                  <th className="py-1.5 pr-3 font-medium">Entry</th>
                  <th className="py-1.5 font-medium">XP</th>
                </tr>
              </thead>
              <tbody>
                {preview.entries.map((entry) => (
                  <tr key={entry.rank}>
                    <td className="py-1.5 pr-3">{entry.rank}</td>
                    <td className="py-1.5 pr-3">{entry.label}</td>
                    <td className="py-1.5">{entry.metricValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
