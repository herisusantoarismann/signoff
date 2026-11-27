"use client";

import React, { useState } from "react";

interface DeleteProjectDialogProps {
  open: boolean;
  projectTitle: string;
  busy?: boolean;
  onArchiveInstead: () => Promise<void> | void;
  onConfirmDelete: (confirmTitle: string) => Promise<void> | void;
  onClose: () => void;
}

export function DeleteProjectDialog({
  open,
  projectTitle,
  busy = false,
  onArchiveInstead,
  onConfirmDelete,
  onClose,
}: DeleteProjectDialogProps) {
  const [typed, setTyped] = useState("");

  if (!open) return null;

  const matches = typed.trim() === projectTitle.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-5 text-[#141414] shadow-xl"
      >
        <h2 className="text-base font-bold text-[#F43F5E]">Hapus proyek permanen?</h2>
        <p className="mt-2 text-sm text-[#52524E]">
          Semua versi, frame, pin, komentar, link review, dan seluruh gambar yang diunggah akan dihapus permanen dan tidak bisa dikembalikan.
        </p>
        <div className="mt-3 rounded border border-[#DFDFD8] bg-[#FAFAF8] p-3 text-xs">
          <span>Ingin menyembunyikan tanpa menghapus file? </span>
          <button
            type="button"
            disabled={busy}
            onClick={onArchiveInstead}
            className="font-semibold underline"
          >
            Arsipkan saja
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold">
            Ketik judul proyek: <span className="font-mono-data">{projectTitle}</span>
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={projectTitle}
            className="mt-1.5 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[40px] rounded border border-[#C9C9C0] px-4 text-sm font-semibold"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!matches || busy}
            onClick={() => onConfirmDelete(typed.trim())}
            className="min-h-[40px] rounded bg-[#F43F5E] px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Menghapus..." : "Hapus permanen"}
          </button>
        </div>
      </div>
    </div>
  );
}
