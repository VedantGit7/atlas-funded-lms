import { createUuid } from "../create-uuid";

export type ToastTone = "success" | "error";

export type ToastRecord = {
  id: string;
  message: string;
  tone: ToastTone;
  exiting?: boolean;
};

type Listener = () => void;

/** Errors stay longer: they carry a reason the person has to read and act on. */
const AUTO_DISMISS_MS: Record<ToastTone, number> = { success: 4500, error: 8000 };
const EXIT_MS = 220;
const MAX_VISIBLE = 3;
/**
 * Messages pushed this close together come from one action: a Save that makes
 * several requests, or a page that saves and then refreshes. They show as one
 * message, not a stack (QA review 1 m11: the form builder's Save fired four
 * toasts that covered the Publish switch).
 */
export const SAME_ACTION_WINDOW_MS = 1500;

let toasts: ToastRecord[] = [];
const pushedAt = new Map<string, number>();
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): readonly ToastRecord[] {
  return toasts;
}

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

function startTimer(id: string, tone: ToastTone) {
  clearTimer(id);
  timers.set(
    id,
    setTimeout(() => {
      dismissToast(id);
    }, AUTO_DISMISS_MS[tone]),
  );
}

function removeNow(id: string) {
  clearTimer(id);
  pushedAt.delete(id);
  toasts = toasts.filter((toast) => toast.id !== id);
}

export function dismissToast(id: string) {
  const target = toasts.find((toast) => toast.id === id);
  if (!target || target.exiting) return;

  clearTimer(id);
  toasts = toasts.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast));
  emit();

  timers.set(
    id,
    setTimeout(() => {
      toasts = toasts.filter((toast) => toast.id !== id);
      timers.delete(id);
      pushedAt.delete(id);
      emit();
    }, EXIT_MS),
  );
}

export function pushToast(message: string, tone: ToastTone): string {
  const now = Date.now();
  const live = toasts.filter((toast) => !toast.exiting);

  // The same words again: keep the one on screen and restart its clock.
  const same = live.find((toast) => toast.message === message && toast.tone === tone);
  if (same) {
    pushedAt.set(same.id, now);
    startTimer(same.id, tone);
    return same.id;
  }

  const fromThisAction = live.filter(
    (toast) => now - (pushedAt.get(toast.id) ?? 0) <= SAME_ACTION_WINDOW_MS,
  );

  if (tone === "error") {
    // A failure ends the action: a "Saved" from a step that went through
    // first would contradict the error beside it.
    for (const toast of fromThisAction) {
      if (toast.tone === "success") removeNow(toast.id);
    }
  } else {
    // Several steps of one action succeeding: show only the latest.
    const earlier = fromThisAction.find((toast) => toast.tone === "success");
    if (earlier) {
      toasts = toasts.map((toast) => (toast.id === earlier.id ? { ...toast, message } : toast));
      pushedAt.set(earlier.id, now);
      startTimer(earlier.id, tone);
      emit();
      return earlier.id;
    }
    // A success right after an error from the same action changes nothing.
    if (fromThisAction.some((toast) => toast.tone === "error")) {
      return fromThisAction.find((toast) => toast.tone === "error")?.id ?? "";
    }
  }

  const id = createUuid();
  const kept = toasts.slice(-(MAX_VISIBLE - 1));
  for (const dropped of toasts.slice(0, toasts.length - kept.length)) {
    clearTimer(dropped.id);
    pushedAt.delete(dropped.id);
  }
  toasts = [...kept, { id, message, tone }];
  pushedAt.set(id, now);
  emit();
  startTimer(id, tone);
  return id;
}

/** Tests only: forget every toast and timer. */
export function resetToastsForTests() {
  for (const id of timers.keys()) clearTimer(id);
  toasts = [];
  pushedAt.clear();
  emit();
}
