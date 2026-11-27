"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { X } from "lucide-react";

export interface ToastItem {
  id: string;
  message: string;
  tone?: "info" | "success" | "error";
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-1), { ...toast, id }]);
      setTimeout(() => dismiss(id), 3500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 left-4 right-4 z-50 flex flex-col items-end gap-2 md:bottom-5 md:left-auto md:right-5"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm items-center gap-3 rounded border border-neutral-800 bg-[#141414] px-3.5 py-2.5 text-sm text-[#F3F3EF] shadow-lg"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                t.tone === "error"
                  ? "bg-[#F43F5E]"
                  : t.tone === "success"
                  ? "bg-[#10B981]"
                  : "bg-[#F3F3EF]"
              }`}
            />
            <span className="flex-1">{t.message}</span>
            {t.actionLabel && t.onAction && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="underline underline-offset-2 text-xs font-semibold text-[#F3F3EF]"
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Tutup notifikasi"
              className="text-neutral-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
