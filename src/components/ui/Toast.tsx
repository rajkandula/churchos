"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; kind: "success" | "error"; message: string };

const ToastContext = createContext<{
  success: (message: string) => void;
  error: (message: string) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4500
    );
  }, []);

  const success = useCallback((m: string) => push("success", m), [push]);
  const error = useCallback((m: string) => push("error", m), [push]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg shadow-slate-900/10 animate-fade-up"
          >
            {t.kind === "success" ? (
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-emerald-500"
                aria-hidden
              />
            ) : (
              <CircleAlert
                className="h-5 w-5 shrink-0 text-rose-500"
                aria-hidden
              />
            )}
            <p className="flex-1 text-sm font-medium text-slate-800">
              {t.message}
            </p>
            <button
              aria-label="Dismiss notification"
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
              className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
