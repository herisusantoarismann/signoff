"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("Supabase belum dikonfigurasi.");
      return;
    }
    setBusy(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F3F3EF] text-[#141414]">
      <header className="border-b border-[#DFDFD8] bg-white px-6 py-3">
        <Link href="/">
          <img src="/brand/signoff-lockup-light.svg" alt="SignOff" className="h-6 w-auto" />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-6"
        >
          <h1 className="text-xl font-bold">Buat password baru</h1>
          {error && (
            <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-[#F43F5E]">
              {error}
            </p>
          )}
          <div className="mt-4">
            <label className="block text-xs font-semibold">Password baru</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 min-h-[40px] w-full rounded bg-[#141414] text-sm font-semibold text-[#F3F3EF]"
          >
            {busy ? "Menyimpan..." : "Simpan password baru"}
          </button>
        </form>
      </main>
    </div>
  );
}
