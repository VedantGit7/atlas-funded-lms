import { createUuid } from "../create-uuid";

export type ToastTone = "success" | "error";

export type ToastRecord = {
  id: string;
  message: string;
  tone: ToastTone;
  exiting?: boolean;
};

type Listener = () => void;

const AUTO_DISMISS_MS = 4500;
const EXIT_MS = 220;
const MAX_VISIBLE = 4;

let toasts: ToastRecord[] = [];
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
      emit();
    }, EXIT_MS),
  );
}

export function pushToast(message: string, tone: ToastTone): string {
  const id = createUuid();
  toasts = [...toasts.slice(-(MAX_VISIBLE - 1)), { id, message, tone }];
  emit();

  timers.set(
    id,
    setTimeout(() => {
      dismissToast(id);
    }, AUTO_DISMISS_MS),
  );

  return id;
}
