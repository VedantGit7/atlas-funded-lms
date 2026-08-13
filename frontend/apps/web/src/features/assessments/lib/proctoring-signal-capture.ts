import { clientApi, createClientUuid } from "../../../lib/client-api";
import type { ProctoringEventType } from "../../../server/proctoring/proctoring.schemas";

type BufferedEvent = {
  eventType: ProctoringEventType;
  occurredAt: string;
  clientEventId: string;
  metadata?: Record<string, unknown>;
};

type AttachOptions = {
  enabled: boolean;
  level?: number;
  onTabHidden?: () => void;
};

type AtlasProctorFixtures = {
  events?: Array<{
    eventType: ProctoringEventType;
    metadata?: Record<string, unknown>;
  }>;
  identityStatus?: "passed" | "failed" | "degraded";
};

declare global {
  interface Window {
    __ATLAS_PROCTOR_FIXTURES__?: AtlasProctorFixtures;
  }
}

function storageKey(attemptId: string): string {
  return `atlas:proctoring:${attemptId}`;
}

function readBuffer(attemptId: string): BufferedEvent[] {
  try {
    const raw = sessionStorage.getItem(storageKey(attemptId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as BufferedEvent[];
  } catch {
    return [];
  }
}

function writeBuffer(attemptId: string, events: BufferedEvent[]): void {
  sessionStorage.setItem(storageKey(attemptId), JSON.stringify(events));
}

function pushEvent(attemptId: string, event: BufferedEvent): void {
  const current = readBuffer(attemptId);
  current.push(event);
  writeBuffer(attemptId, current);
}

async function flush(attemptId: string): Promise<void> {
  const events = readBuffer(attemptId);
  if (events.length === 0) return;

  const batch = events.slice(0, 50);
  const batchKey = createClientUuid();

  try {
    await clientApi.postWithKey(
      `/api/v1/attempts/${attemptId}/proctoring-events`,
      { events: batch },
      batchKey,
      { silent: true },
    );
    const remaining = readBuffer(attemptId).filter(
      (event) => !batch.some((accepted) => accepted.clientEventId === event.clientEventId),
    );
    writeBuffer(attemptId, remaining);
  } catch {
    // Keep buffered events for the next flush attempt.
  }
}

async function postIdentityVerification(
  attemptId: string,
  body: {
    status: "passed" | "failed" | "degraded";
    method: "id_face_match" | "fixture";
    score?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await clientApi.postWithKey(
      `/api/v1/attempts/${attemptId}/proctoring/identity-verification`,
      body,
      createClientUuid(),
      { silent: true },
    );
  } catch {
    // Advisory only — never block the attempt.
  }
}

function attachL1Signals(
  attemptId: string,
  options: AttachOptions,
  record: (eventType: ProctoringEventType, metadata?: Record<string, unknown>) => void,
): () => void {
  const onVisibilityChange = () => {
    if (document.hidden) {
      record("tab_hidden");
      void flush(attemptId);
    }
  };

  const onBlur = () => {
    record("window_blur");
  };

  const onFullscreenChange = () => {
    if (!document.fullscreenElement) {
      record("fullscreen_exit");
    }
  };

  const onCopy = () => {
    record("copy");
  };

  const onCut = () => {
    record("cut");
  };

  const onPaste = () => {
    record("paste");
  };

  const onContextMenu = () => {
    record("context_menu");
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", onBlur);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("copy", onCopy);
  document.addEventListener("cut", onCut);
  document.addEventListener("paste", onPaste);
  document.addEventListener("contextmenu", onContextMenu);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("copy", onCopy);
    document.removeEventListener("cut", onCut);
    document.removeEventListener("paste", onPaste);
    document.removeEventListener("contextmenu", onContextMenu);
  };
}

function attachL2MediaSignals(
  attemptId: string,
  record: (eventType: ProctoringEventType, metadata?: Record<string, unknown>) => void,
): () => void {
  const lifetime = { cancelled: false };
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let rafId = 0;
  let faceIntervalId = 0;
  let lastMicEmitAt = 0;
  let lastFaceState: "present" | "absent" | "multiple" | null = null;

  const fixtures = window.__ATLAS_PROCTOR_FIXTURES__;
  if (fixtures?.events?.length) {
    for (const fixtureEvent of fixtures.events) {
      record(fixtureEvent.eventType, fixtureEvent.metadata);
    }
  }

  const emitFace = (state: "present" | "absent" | "multiple") => {
    if (state === lastFaceState) return;
    lastFaceState = state;
    if (state === "present") record("face_present");
    else if (state === "absent") record("face_absent");
    else record("multiple_faces");
  };

  const startFaceHeuristic = (video?: HTMLVideoElement) => {
    type FaceDetectorCtor = new (options?: { maxDetectedFaces?: number }) => {
      detect: (source: HTMLVideoElement) => Promise<Array<unknown>>;
    };
    const Detector = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;

    faceIntervalId = window.setInterval(() => {
      if (lifetime.cancelled) return;
      if (fixtures?.events?.length) return;

      if (Detector && video && video.readyState >= 2) {
        const detector = new Detector({ maxDetectedFaces: 3 });
        void detector
          .detect(video)
          .then((faces) => {
            if (faces.length === 0) emitFace("absent");
            else if (faces.length === 1) emitFace("present");
            else emitFace("multiple");
          })
          .catch(() => {
            // Skip face events when detector fails — degrade, don't block.
          });
        return;
      }

      // Lightweight fallback: visibility only; skip face events when no detector.
      if (document.hidden) {
        emitFace("absent");
      }
    }, 4000);
  };

  const startMicMonitoring = (stream: MediaStream) => {
    const AudioCtx =
      typeof window.AudioContext === "function"
        ? window.AudioContext
        : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (typeof AudioCtx !== "function") return;

    audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (lifetime.cancelled || !analyser) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (const value of data) sum += value;
      const energy = sum / data.length;
      const now = Date.now();
      if (energy > 28 && now - lastMicEmitAt > 8000) {
        lastMicEmitAt = now;
        record("microphone_activity", { energy: Math.round(energy) });
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
  };

  void (async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (lifetime.cancelled) {
        mediaStream.getTracks().forEach((track) => {
          track.stop();
        });
        return;
      }

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = mediaStream;
      void video.play().catch(() => undefined);

      startMicMonitoring(mediaStream);
      startFaceHeuristic(video);
    } catch (error) {
      const name =
        error && typeof error === "object" && "name" in error ? String(error.name) : "unknown";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        record("media_permission_denied", { reason: name });
      } else {
        record("media_unavailable", { reason: name });
      }
      startFaceHeuristic();
    }
  })();

  return () => {
    lifetime.cancelled = true;
    if (rafId) window.cancelAnimationFrame(rafId);
    if (faceIntervalId) window.clearInterval(faceIntervalId);
    if (audioContext) {
      void audioContext.close().catch(() => undefined);
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  };
}

/**
 * Generalized proctoring signal capture.
 * L1: browser signals. L2+: media heuristics (degrade, never block). L3: identity POST.
 */
export function attachProctoringSignalCapture(
  attemptId: string,
  options: AttachOptions,
): () => void {
  if (!options.enabled || typeof window === "undefined") {
    return () => undefined;
  }

  const level = options.level ?? 1;

  const record = (eventType: ProctoringEventType, metadata?: Record<string, unknown>) => {
    const event: BufferedEvent = {
      eventType,
      occurredAt: new Date().toISOString(),
      clientEventId: createClientUuid(),
      ...(metadata ? { metadata } : {}),
    };
    pushEvent(attemptId, event);
    if (eventType === "tab_hidden") {
      options.onTabHidden?.();
    }
  };

  const detachL1 = attachL1Signals(attemptId, options, record);
  const detachL2 = level >= 2 ? attachL2MediaSignals(attemptId, record) : () => undefined;

  if (level >= 3) {
    const fixtures = window.__ATLAS_PROCTOR_FIXTURES__;
    if (fixtures?.identityStatus) {
      void postIdentityVerification(attemptId, {
        status: fixtures.identityStatus,
        method: "fixture",
        metadata: { source: "atlas_proctor_fixtures" },
      });
    } else {
      // Production path without ID vendor: degrade rather than block.
      void postIdentityVerification(attemptId, {
        status: "degraded",
        method: "fixture",
        metadata: { reason: "no_id_vendor" },
      });
    }
  }

  const intervalId = window.setInterval(() => {
    void flush(attemptId);
  }, 5000);

  return () => {
    detachL1();
    detachL2();
    window.clearInterval(intervalId);
    void flush(attemptId);
  };
}

/** @deprecated Use attachProctoringSignalCapture */
export function attachL1SignalCapture(attemptId: string, options: AttachOptions): () => void {
  return attachProctoringSignalCapture(attemptId, options);
}

/** Test helper: trigger fixture identity verification from UI. */
export async function submitFixtureIdentityVerification(
  attemptId: string,
  status: "passed" | "failed" | "degraded" = "passed",
): Promise<void> {
  await postIdentityVerification(attemptId, {
    status,
    method: "fixture",
    metadata: { source: "ui_test_button" },
  });
}
