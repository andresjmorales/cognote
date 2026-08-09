"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  /** Show a transient notification. Errors stay on screen longer. */
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-primary text-white",
  error: "bg-error text-white",
  info: "bg-foreground text-surface",
};

const SUCCESS_TTL_MS = 3500;
const ERROR_TTL_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      const ttl = variant === "error" ? ERROR_TTL_MS : SUCCESS_TTL_MS;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role={toast.variant === "error" ? "alert" : "status"}
              className={`flex items-center gap-3 max-w-sm px-4 py-2 rounded-lg shadow-lg text-sm animate-[fadeIn_0.2s] ${VARIANT_CLASSES[toast.variant]}`}
            >
              <span className="min-w-0 break-words">{toast.message}</span>
              <button
                type="button"
                aria-label="Dismiss"
                className="shrink-0 opacity-70 hover:opacity-100 font-bold leading-none cursor-pointer"
                onClick={() => dismiss(toast.id)}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
