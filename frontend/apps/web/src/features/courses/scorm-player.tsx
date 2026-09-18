"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientApiError, clientApi } from "../../lib/client-api";

type ScormLaunchData = {
  moduleId: string;
  courseId: string;
  title: string;
  scormVersion: "1.2" | "2004";
  launchPath: string;
  contentUrl: string;
  progress: {
    status: "not_started" | "in_progress" | "completed";
    progressPct: number;
    completedAt: string | null;
  };
};

type ScormPlayerProps = {
  launch: ScormLaunchData;
};

type ScormCmi = Record<string, string>;

function flattenCmi(cmi: Record<string, string | number | boolean>): ScormCmi {
  const flat: ScormCmi = {};
  for (const [key, value] of Object.entries(cmi)) {
    flat[key] = String(value);
  }
  return flat;
}

function createScorm12Api(args: {
  initialCmi: ScormCmi;
  onCommit: (cmi: ScormCmi) => Promise<void>;
}) {
  const cmi = { ...args.initialCmi };
  let initialized = false;
  let finished = false;

  if (!cmi["cmi.core.lesson_status"]) {
    cmi["cmi.core.lesson_status"] = "not attempted";
  }
  if (!cmi["cmi.core.entry"]) {
    cmi["cmi.core.entry"] = "ab-initio";
  }

  const api = {
    LMSInitialize: () => {
      if (finished) return "false";
      initialized = true;
      return "true";
    },
    LMSFinish: () => {
      if (!initialized) return "false";
      finished = true;
      void args.onCommit(cmi);
      return "true";
    },
    LMSGetValue: (key: string) => {
      if (!initialized) return "";
      return cmi[key] ?? "";
    },
    LMSSetValue: (key: string, value: string) => {
      if (!initialized || finished) return "false";
      cmi[key] = value;
      return "true";
    },
    LMSCommit: () => {
      if (!initialized) return "false";
      void args.onCommit(cmi);
      return "true";
    },
    LMSGetLastError: () => "0",
    LMSGetErrorString: () => "No error",
    LMSGetDiagnostic: () => "No error",
  };

  return api;
}

export function ScormPlayer({ launch }: ScormPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(launch.progress.status);
  const initialCmiRef = useRef<ScormCmi>({});

  const commitProgress = useCallback(
    async (cmi: ScormCmi) => {
      try {
        const lessonStatus = cmi["cmi.core.lesson_status"] ?? "";
        const completed =
          lessonStatus === "completed" || lessonStatus === "passed" || lessonStatus === "failed";

        const response = await clientApi.put<{
          data: { status: typeof status; progressPct: number };
        }>(
          `/api/v1/modules/${launch.moduleId}/scorm-progress`,
          {
            cmi,
            ...(completed ? { completed: true } : {}),
          },
          "module-scorm-progress",
        );

        setStatus(response.data.status);
      } catch (commitError) {
        if (commitError instanceof ClientApiError) {
          setError(commitError.message);
        }
      }
    },
    [launch.moduleId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialCmi() {
      try {
        const response = await clientApi.get<{
          data: { cmi: Record<string, string | number | boolean> };
        }>(`/api/v1/modules/${launch.moduleId}/scorm-progress`);

        if (!cancelled) {
          initialCmiRef.current = flattenCmi(response.data.cmi);
        }
      } catch {
        if (!cancelled) {
          initialCmiRef.current = {};
        }
      }
    }

    void loadInitialCmi();

    return () => {
      cancelled = true;
    };
  }, [launch.moduleId]);

  const iframeSrc = useMemo(() => launch.contentUrl, [launch.contentUrl]);

  useEffect(() => {
    const api = createScorm12Api({
      initialCmi: initialCmiRef.current,
      onCommit: commitProgress,
    });

    window.API = api;

    return () => {
      delete window.API;
    };
  }, [commitProgress, launch.moduleId]);

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <iframe
          ref={iframeRef}
          title={launch.title}
          src={iframeSrc}
          className="h-[min(70vh,720px)] w-full bg-white"
          allow="fullscreen"
        />
      </div>

      <p className="text-sm opacity-70">
        SCORM {launch.scormVersion} · Status: {status.replaceAll("_", " ")}
      </p>
    </div>
  );
}

declare global {
  interface Window {
    API?: ReturnType<typeof createScorm12Api>;
  }
}
