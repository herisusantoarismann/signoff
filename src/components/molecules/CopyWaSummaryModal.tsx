"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatWhatsAppSummary } from "@/lib/utils/wa-summary";
import type { DesignFrameRecord, PinRecord } from "@/lib/domain/types";

interface CopyWaSummaryModalProps {
  open: boolean;
  projectTitle: string;
  versionLabel: string;
  pins: PinRecord[];
  frames: DesignFrameRecord[];
  onClose: () => void;
  onCopied?: () => void;
}

export function CopyWaSummaryModal({
  open,
  projectTitle,
  versionLabel,
  pins,
  frames,
  onClose,
  onCopied,
}: CopyWaSummaryModalProps) {
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved">("open");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const summaryText = formatWhatsAppSummary({
    projectTitle,
    versionLabel,
    pins,
    frames,
    statusFilter,
  });

  async function handleCopy() {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: user copies manually from selectable textarea
    }
  }

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
        <h2 className="text-base font-bold">Copy Ringkasan ke WhatsApp</h2>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            className={`flex-1 rounded py-1.5 text-xs font-semibold border ${
              statusFilter === "open"
                ? "border-[#141414] bg-[#141414] text-[#F3F3EF]"
                : "border-[#C9C9C0] bg-white text-[#141414]"
            }`}
          >
            Pin Open
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            className={`flex-1 rounded py-1.5 text-xs font-semibold border ${
              statusFilter === "resolved"
                ? "border-[#141414] bg-[#141414] text-[#F3F3EF]"
                : "border-[#C9C9C0] bg-white text-[#141414]"
            }`}
          >
            Pin Resolved
          </button>
        </div>

        {!summaryText ? (
          <div className="mt-3 rounded border border-[#DFDFD8] bg-[#F3F3EF] p-4 text-center text-xs text-[#52524E]">
            Belum ada pin berstatus{" "}
            <strong>{statusFilter === "open" ? "Open" : "Resolved"}</strong> pada{" "}
            <span className="font-mono-data">{versionLabel}</span>.
          </div>
        ) : (
          <textarea
            readOnly
            rows={7}
            value={summaryText}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono-data mt-3 w-full rounded border border-[#C9C9C0] bg-[#FAFAF8] p-2.5 text-xs"
          />
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded border border-[#C9C9C0] px-4 text-sm font-semibold"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={!summaryText}
            onClick={handleCopy}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded bg-[#141414] px-4 text-sm font-semibold text-[#F3F3EF] disabled:opacity-40"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Tersalin" : "Copy Ringkasan"}
          </button>
        </div>
      </div>
    </div>
  );
}
