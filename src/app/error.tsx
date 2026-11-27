"use client";

import React from "react";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F3EF] p-6 text-center text-[#141414]">
      <img src="/brand/signoff-mark.svg" alt="SignOff" className="mb-4 h-9 w-9" />
      <h1 className="text-xl font-bold tracking-tight">Terjadi gangguan sementara</h1>
      <p className="mt-2 max-w-md text-sm text-[#52524E]">
        Maaf, halaman gagal dimuat dengan benar. Silakan coba muat ulang.
      </p>
      {error.digest && (
        <p className="font-mono-data mt-2 text-xs text-[#787872]">
          Ref: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-5 min-h-[40px] rounded bg-[#141414] px-4 text-sm font-semibold text-[#F3F3EF]"
      >
        Coba lagi
      </button>
    </div>
  );
}
