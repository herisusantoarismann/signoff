"use client";

import React, { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { buildWhatsAppShareUrl } from "@/lib/utils/wa-summary";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";

interface SharePanelProps {
  open: boolean;
  projectTitle: string;
  versionLabel: string;
  shareToken: string;
  hasPasscode: boolean;
  onUpdatePasscode: (newPasscode: string | null) => Promise<void>;
  onRotateToken: () => Promise<void>;
  onClose: () => void;
}

export function SharePanel({
  open,
  projectTitle,
  versionLabel,
  shareToken,
  hasPasscode,
  onUpdatePasscode,
  onRotateToken,
  onClose,
}: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const [newPasscode, setNewPasscode] = useState("");
  const [includePassInWa, setIncludePassInWa] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const reviewUrl = `${origin}/r/${shareToken}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: selectable input
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg border border-[#C9C9C0] bg-white p-5 text-[#141414] shadow-xl"
        >
          <h2 className="text-base font-bold">Bagikan link review ke klien</h2>
          <p className="mt-1 text-xs text-[#52524E]">
            Klien cukup buka link di browser HP atau laptop tanpa perlu daftar akun.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={reviewUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono-data min-h-[40px] min-w-0 flex-1 rounded border border-[#C9C9C0] bg-[#FAFAF8] px-3 text-xs"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded bg-[#141414] px-3 text-xs font-semibold text-[#F3F3EF]"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Disalin" : "Copy link"}
            </button>
          </div>

          <div className="mt-4 rounded border border-[#DFDFD8] bg-[#FAFAF8] p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                Passcode 4 digit: {hasPasscode ? "Aktif" : "Nonaktif"}
              </span>
              {hasPasscode && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onUpdatePasscode(null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="text-[#F43F5E] underline"
                >
                  Matikan
                </button>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                inputMode="numeric"
                maxLength={4}
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Passcode baru (4 digit)"
                className="font-mono-data min-h-[34px] flex-1 rounded border border-[#C9C9C0] bg-white px-2.5 text-xs"
              />
              <button
                type="button"
                disabled={!/^\d{4}$/.test(newPasscode) || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onUpdatePasscode(newPasscode);
                    setNewPasscode("");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="min-h-[34px] rounded border border-[#141414] px-3 text-xs font-semibold disabled:opacity-40"
              >
                Simpan
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#DFDFD8] pt-3">
            <div>
              <a
                href={buildWhatsAppShareUrl({
                  reviewUrl,
                  projectTitle,
                  versionLabel,
                  passcode: includePassInWa && /^\d{4}$/.test(newPasscode) ? newPasscode : null,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[38px] items-center rounded border border-[#C9C9C0] bg-white px-3 text-xs font-semibold text-[#141414] hover:bg-[#F3F3EF]"
              >
                Bagikan via WhatsApp
              </a>
              {hasPasscode && (
                <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#52524E]">
                  <input
                    type="checkbox"
                    checked={includePassInWa}
                    onChange={(e) => setIncludePassInWa(e.target.checked)}
                  />
                  Sertakan passcode baru yang diketik
                </label>
              )}
            </div>

            <button
              type="button"
              onClick={() => setConfirmRotate(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded border border-rose-300 px-3 text-xs font-semibold text-[#F43F5E] hover:bg-rose-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Buat link baru
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRotate}
        title="Buat link review baru?"
        description="Link lama dan seluruh sesi tamu klien yang sedang aktif akan langsung berhenti bekerja."
        confirmLabel="Ya, ganti link"
        destructive
        busy={busy}
        onCancel={() => setConfirmRotate(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await onRotateToken();
            setConfirmRotate(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
