import { atom, type Setter } from "jotai/vanilla";
import type { AvailableMessage, MessageParamMap } from "./i18n.js";

export type ToastSeverity = "info" | "warning" | "error";

export interface Toast {
  readonly id: string;
  readonly message: AvailableMessage;
  readonly params?: object;
  readonly severity: ToastSeverity;
  readonly createdAt: number;
  readonly duration: number;
}

export interface ToastOptions<T extends AvailableMessage> {
  readonly message: T;
  readonly params?: MessageParamMap[T];
  readonly severity?: ToastSeverity;
  readonly duration?: number | null;
}

const DEFAULT_SEVERITY: ToastSeverity = "info";

const DEFAULT_DURATION_MAP = {
  info: 5000,
  warning: 7000,
  error: 10000,
} as const satisfies Record<ToastSeverity, number>;

const toastsBaseAtom = atom<readonly Toast[]>([]);

export const toastsAtom = atom((get) => get(toastsBaseAtom));

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.cause) {
      return `${error.message}\n  Caused by: ${formatErrorMessage(error.cause)}`;
    }
    return error.message;
  } else if (typeof error === "string") {
    return error;
  } else if (error && typeof error === "object" && "message" in error) {
    return (error as { message: string }).message;
  } else {
    return "An unknown error occurred";
  }
}

export function addToast<T extends AvailableMessage>(
  set: Setter,
  options: ToastOptions<T>,
): void {
  const { message, params } = options;
  const severity = options.severity ?? DEFAULT_SEVERITY;
  const duration = options.duration ?? DEFAULT_DURATION_MAP[severity];

  const toast: Toast = {
    id: crypto.randomUUID(),
    message,
    params,
    severity,
    createdAt: Date.now(),
    duration,
  };

  set(toastsBaseAtom, (prev) => [...prev, toast]);
}

export function removeToast(set: Setter, id: string): void {
  set(toastsBaseAtom, (prev) => prev.filter((toast) => toast.id !== id));
}

export function clearToasts(set: Setter): void {
  set(toastsBaseAtom, []);
}
