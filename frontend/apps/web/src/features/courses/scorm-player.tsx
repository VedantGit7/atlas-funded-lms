"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import type { moduleScormLaunchResponseSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { ClientApiError, clientApi, createClientUuid } from "../../lib/client-api";
import {
  isFromPackageFrame,
  parseScormBridgeMessage,
  SCORM_PLAYER_PROTOCOL,
  ScormSaveQueue,
  type ScormSave,
} from "./scorm-bridge";

type ScormLaunchData = z.infer<typeof moduleScormLaunchResponseSchema>["data"];
type ProgressStatus = ScormLaunchData["progress"]["status"];
type ProgressResponse = {
  data: { status: ProgressStatus; cmi: Record<string, string | number | boolean> };
};

type ScormPlayerProps = {
  launch: ScormLaunchData;
};

/** Comfortably inside the progress endpoint's per-learner write budget. */
const SAVE_INTERVAL_MS = 2_000;

function asStrings(cmi: Record<string, string | number | boolean>): Record<string, string> {
  return Object.fromEntries(Object.entries(cmi).map(([key, value]) => [key, String(value)]));
}

/**
 * Plays a SCORM package and records its progress.
 *
 * The package loads from a per-launch capability URL into an opaque sandbox:
 * it cannot read this page, its cookies or its storage. Each package document
 * carries its own SCORM 1.2 and 2004 API (served with it, seeded with saved
 * data) and reports here; this component only accepts this launch's protocol,
 * only from inside its own iframe, and only ever saves progress.
 */
export function ScormPlayer({ launch }: ScormPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProgressStatus>(launch.progress.status);
  // The package can initialize and commit the moment it loads, so it is only
  // pointed at its content once the bridge is listening.
  const [listening, setListening] = useState(false);
  // The latest saved data: answers a newly loaded package document that may have
  // been served before another document's save landed.
  const savedValuesRef = useRef<Record<string, string> | null>(null);
  const queueRef = useRef<ScormSaveQueue | null>(null);
  const progressPath = `/api/v1/modules/${launch.moduleId}/scorm-progress`;

  const send = useCallback(
    async (save: ScormSave) => {
      const response = await clientApi.put<ProgressResponse>(
        progressPath,
        { cmi: save.cmi, ...(save.terminated ? { terminated: true } : {}) },
        "module-scorm-progress",
        { silent: true },
      );
      savedValuesRef.current = asStrings(response.data.cmi);
      setStatus(response.data.status);
      setError(null);
    },
    [progressPath],
  );

  useEffect(() => {
    const queue = new ScormSaveQueue(send, {
      minIntervalMs: SAVE_INTERVAL_MS,
      onError: (saveError) => {
        setError(
          saveError instanceof ClientApiError
            ? `Your progress could not be saved: ${saveError.message} It will be retried.`
            : "Your progress could not be saved. It will be retried.",
        );
      },
    });
    queueRef.current = queue;

    // Last chance when the learner leaves mid-session: a keepalive request
    // outlives the page, where an ordinary fetch would be cancelled.
    const flushOnExit = () => {
      const pending = queue.takePending();
      if (!pending) return;
      void fetch(progressPath, {
        method: "PUT",
        keepalive: true,
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `module-scorm-progress-${createClientUuid()}`,
        },
        body: JSON.stringify({
          cmi: pending.cmi,
          ...(pending.terminated ? { terminated: true } : {}),
        }),
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", flushOnExit);

    return () => {
      window.removeEventListener("pagehide", flushOnExit);
      flushOnExit();
      queue.dispose();
      queueRef.current = null;
    };
  }, [progressPath, send]);

  useEffect(() => {
    let cancelled = false;
    void clientApi
      .get<ProgressResponse>(progressPath)
      .then((response) => {
        if (!cancelled) savedValuesRef.current = asStrings(response.data.cmi);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [progressPath]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isFromPackageFrame(event.source, iframeRef.current?.contentWindow)) return;
      const message = parseScormBridgeMessage(event.data, launch.launchId);
      if (!message) return;

      if (message.type === "hello") {
        if (savedValuesRef.current && event.source) {
          // Opaque documents have origin "null", so no narrower target exists;
          // the recipient is the frame just verified to be inside our iframe.
          (event.source as Window).postMessage(
            {
              protocol: SCORM_PLAYER_PROTOCOL,
              version: 1,
              launchId: launch.launchId,
              type: "state",
              values: savedValuesRef.current,
            },
            "*",
          );
        }
        return;
      }
      if (message.type === "initialize") {
        setStatus((current) => (current === "not_started" ? "in_progress" : current));
        return;
      }
      queueRef.current?.enqueue({
        cmi: message.values ?? {},
        terminated: message.type === "terminate",
      });
    };
    window.addEventListener("message", onMessage);
    setListening(true);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [launch.launchId]);

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-text"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <iframe
          ref={iframeRef}
          title={launch.title}
          src={listening ? launch.contentUrl : undefined}
          // The response also sends this sandbox as a CSP header; the attribute keeps
          // the package opaque even if a proxy were ever to drop that header.
          // Never add allow-same-origin.
          sandbox="allow-scripts allow-forms allow-popups"
          referrerPolicy="no-referrer"
          className="h-[min(70vh,720px)] w-full bg-card"
          allow="fullscreen"
        />
      </div>

      <p className="text-sm opacity-70">
        SCORM {launch.scormVersion} · Status: {status.replaceAll("_", " ")}
      </p>
    </div>
  );
}
