"use client";

import React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

interface SessionExpiredModalProps {
  open: boolean;
  nextPath?: string;
}

/**
 * G07 Session Expired recovery modal shown when an owner API call returns 401 mid-work.
 * Offers re-authentication returning directly to the current workspace URL.
 */
export function SessionExpiredModal({ open, nextPath }: SessionExpiredModalProps) {
  if (!open) return null;

  const loginHref = nextPath
    ? `/login?next=${encodeURIComponent(nextPath)}`
    : "/login";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-6 text-[#141414] shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="session-expired-title" className="text-base font-bold">
              Sesi login berakhir
            </h2>
            <p className="text-xs text-[#52524E]">
              Autentikasi Anda perlu diperbarui sebelum menyimpan perubahan.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[#52524E]">
          Tenang, perubahan terakhir yang gagal disimpan masih ada di layar ini.
          Login kembali untuk melanjutkan di halaman yang sama.
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Link
            href={loginHref}
            className="inline-flex min-h-[40px] items-center justify-center rounded bg-[#141414] px-4 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Login Ulang
          </Link>
        </div>
      </div>
    </div>
  );
}
