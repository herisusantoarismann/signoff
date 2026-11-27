"use client";

import React, { useState } from "react";
import type { ApprovalSource } from "@/lib/domain/types";

interface RecordApprovalDialogProps {
  open: boolean;
  defaultClientName?: string | null;
  busy?: boolean;
  onConfirm: (data: {
    clientName: string;
    source: ApprovalSource;
    note: string;
  }) => Promise<void> | void;
  onClose: () => void;
}

const SOURCE_LABELS: Record<ApprovalSource, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Meeting",
  other: "Lainnya",
};

export function RecordApprovalDialog({
  open,
  defaultClientName,
  busy = false,
  onConfirm,
  onClose,
}: RecordApprovalDialogProps) {
  const [clientName, setClientName] = useState(defaultClientName || "");
  const [source, setSource] = useState<ApprovalSource>("whatsapp");
  const [note, setNote] = useState("");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-5 text-[#141414] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">Catat ACC dari klien</h2>
        <p className="mt-1 text-xs text-[#52524E]">
          Gunakan ini jika klien memberi persetujuan di luar SignOff (misalnya lewat chat WhatsApp).
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold">Nama klien</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Misal: Budi"
              className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold">Sumber persetujuan</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as ApprovalSource)}
              className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] bg-white px-3 text-sm"
            >
              {(Object.keys(SOURCE_LABELS) as ApprovalSource[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold">Catatan (opsional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Misal: ACC di grup WA pukul 14.10"
              className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 rounded border border-[#DFDFD8] bg-[#F3F3EF] p-2.5 text-xs text-[#52524E]">
          Label tampil: <strong>Dicatat oleh desainer:</strong> ACC dari{" "}
          {clientName.trim() || "Klien"} via {SOURCE_LABELS[source]}
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
            disabled={!clientName.trim() || busy}
            onClick={() => onConfirm({ clientName: clientName.trim(), source, note: note.trim() })}
            className="min-h-[40px] rounded bg-[#141414] px-4 text-sm font-semibold text-[#F3F3EF] disabled:opacity-45"
          >
            {busy ? "Menyimpan..." : "Simpan Catatan ACC"}
          </button>
        </div>
      </div>
    </div>
  );
}
