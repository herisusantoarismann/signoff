"use client";

import React, { useState } from "react";

interface ApprovalDialogProps {
  open: boolean;
  versionLabel: string;
  actorName: string;
  unsentDraftCount: number;
  busy?: boolean;
  onConfirm: (confirmName: string) => Promise<void> | void;
  onSendDraftsFirst?: () => Promise<void> | void;
  onClose: () => void;
}

export function ApprovalDialog({
  open,
  versionLabel,
  actorName,
  unsentDraftCount,
  busy = false,
  onConfirm,
  onSendDraftsFirst,
  onClose,
}: ApprovalDialogProps) {
  const [confirmName, setConfirmName] = useState("");
  const [agreed, setAgreed] = useState(false);

  if (!open) return null;

  const nameMatches =
    confirmName.trim().length > 0 &&
    confirmName.trim().toLowerCase() === actorName.trim().toLowerCase();
  const canSubmit = nameMatches && agreed && !busy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-dialog-title"
        className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-5 text-[#141414] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="approval-dialog-title" className="text-base font-bold">
          Approve versi <span className="font-mono-data">{versionLabel}</span>?
        </h2>
        <p className="mt-1.5 text-sm text-[#52524E]">
          Setelah disetujui, versi ini dikunci dari pin baru dan dicatat dengan nama serta waktu persetujuan kamu.
        </p>

        {unsentDraftCount > 0 && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">
              Kamu punya {unsentDraftCount} draft feedback yang belum dikirim.
            </p>
            {onSendDraftsFirst && (
              <button
                type="button"
                onClick={onSendDraftsFirst}
                className="mt-1.5 font-semibold underline"
              >
                Kirim draft dulu sebelum ACC
              </button>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs font-semibold">
            Ketik ulang nama kamu (<span className="font-mono-data">{actorName}</span>)
          </label>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={actorName}
            className="mt-1.5 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm focus:border-[#141414] focus:outline-none"
          />
          {confirmName.trim().length > 0 && !nameMatches && (
            <p className="mt-1 text-xs text-[#F43F5E]">
              Harus sesuai dengan &ldquo;{actorName}&rdquo;.
            </p>
          )}
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#141414]"
          />
          <span>
            Saya menyetujui desain <strong className="font-mono-data">{versionLabel}</strong>{" "}
            sebagai versi final.
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[40px] rounded border border-[#C9C9C0] bg-white px-4 text-sm font-semibold text-[#141414]"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm(confirmName.trim())}
            className="min-h-[40px] rounded bg-[#141414] px-4 text-sm font-semibold text-[#F3F3EF] disabled:opacity-40"
          >
            {busy ? "Menyimpan..." : "Approve Versi Ini"}
          </button>
        </div>
      </div>
    </div>
  );
}
