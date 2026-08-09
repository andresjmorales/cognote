"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" renders a red confirm button for destructive actions. */
  variant?: "danger" | "primary";
};

type ConfirmContextValue = {
  /** Promise resolves true when confirmed, false when cancelled. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue["confirm"] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmDialogProvider>");
  }
  return ctx.confirm;
}

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending((current) => {
        // A second confirm while one is open cancels the first.
        current?.resolve(false);
        return { options, resolve };
      });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      setPending((current) => {
        current?.resolve(result);
        return null;
      });
    },
    []
  );

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  const options = pending?.options;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 border-0 cursor-default"
            aria-label="Cancel"
            onClick={() => close(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-surface shadow-xl p-5 space-y-4"
          >
            <h2 id="confirm-dialog-title" className="text-base font-semibold">
              {options.title ?? "Are you sure?"}
            </h2>
            <p
              id="confirm-dialog-message"
              className="text-sm text-muted whitespace-pre-line"
            >
              {options.message}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => close(false)}
                autoFocus
              >
                {options.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={options.variant === "danger" ? "error" : "primary"}
                size="sm"
                onClick={() => close(true)}
              >
                {options.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
