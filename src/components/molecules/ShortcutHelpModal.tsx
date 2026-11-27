"use client";

import React from "react";

interface ShortcutHelpModalProps {
  open: boolean;
  isOwner?: boolean;
  onClose: () => void;
}

export function ShortcutHelpModal({ open, isOwner = false, onClose }: ShortcutHelpModalProps) {
  if (!open) return null;

  const rows: Array<[string, string]> = [
    ["P", "Mode Pin Titik"],
    ["B", "Mode Area Box"],
    ["Space (tahan)", "Geser kanvas (Pan)"],
    ["N / Shift+N", "Pin berikutnya / sebelumnya"],
    ...(isOwner ? ([["R", "Tandai pin aktif sebagai Resolved"]] as Array<[string, string]>) : []),
    ["Esc", "Tutup popover atau dialog"],
    ["?", "Buka bantuan shortcut ini"],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-title"
        className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-5 text-[#141414] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="shortcut-title" className="text-base font-bold">
          Shortcut Keyboard
        </h2>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
          {rows.map(([key, label]) => (
            <React.Fragment key={key}>
              <kbd className="font-mono-data rounded border border-[#DFDFD8] bg-[#F3F3EF] px-2 py-0.5 text-xs font-semibold">
                {key}
              </kbd>
              <span className="text-[#52524E]">{label}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded bg-[#141414] px-4 text-sm font-semibold text-[#F3F3EF]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
