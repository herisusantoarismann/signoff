"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  const [tab, setTab] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [magicSentTo, setMagicSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    const supabase = createBrowserSupabaseClient();
    supabase?.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
      }
    });
  }, [configured, router, nextPath]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handlePasswordAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 6) {
      setError("Masukkan email valid dan password minimal 6 karakter.");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("Supabase belum dikonfigurasi (.env.local). Gunakan /demo untuk mencoba tanpa login.");
      return;
    }

    setBusy(true);
    try {
      if (tab === "signup") {
        const { error: signErr } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (signErr) {
          setError(
            signErr.message.toLowerCase().includes("already")
              ? "Email ini sudah terdaftar. Silakan masuk."
              : signErr.message
          );
          return;
        }
        setInfo("Akun dibuat. Cek email kamu untuk konfirmasi pendaftaran.");
      } else {
        const { error: inErr } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (inErr) {
          setError("Email atau password tidak sesuai.");
          return;
        }
        router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Masukkan email terlebih dahulu.");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("Supabase belum dikonfigurasi (.env.local). Gunakan /demo untuk mencoba tanpa login.");
      return;
    }
    setBusy(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
      });
      if (otpErr) {
        setError(otpErr.message);
        return;
      }
      setMagicSentTo(trimmedEmail);
      setCooldown(60);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Masukkan email kamu.");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("Supabase belum dikonfigurasi (.env.local).");
      return;
    }
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setInfo("Jika email terdaftar, link reset password telah dikirim. Cek inbox kamu.");
    } finally {
      setBusy(false);
    }
  }

  if (magicSentTo) {
    return (
      <div className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-6">
        <img src="/brand/signoff-mark.svg" alt="" className="mb-4 h-7 w-7" />
        <h1 className="text-xl font-bold">Cek email kamu</h1>
        <p className="mt-2 text-sm text-[#52524E]">
          Magic link sudah dikirim ke <span className="font-mono-data">{magicSentTo}</span>. Jika link dibuka di HP atau browser lain, proses masuk terjadi di perangkat tersebut.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={cooldown > 0 || busy}
            onClick={handleMagicLink}
            className="min-h-[38px] rounded bg-[#141414] px-4 text-xs font-semibold text-[#F3F3EF] disabled:opacity-45"
          >
            {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : "Kirim ulang"}
          </button>
          <button
            type="button"
            onClick={() => setMagicSentTo(null)}
            className="min-h-[38px] rounded border border-[#C9C9C0] px-4 text-xs font-semibold"
          >
            Salah email?
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-6">
      {tab !== "forgot" ? (
        <>
          <div className="mb-5 flex gap-1.5 rounded-md bg-[#F3F3EF] p-1">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setError(null);
              }}
              className={`min-h-[36px] flex-1 rounded text-xs font-semibold ${
                tab === "login" ? "bg-[#141414] text-[#F3F3EF]" : "text-[#52524E]"
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("signup");
                setError(null);
              }}
              className={`min-h-[36px] flex-1 rounded text-xs font-semibold ${
                tab === "signup" ? "bg-[#141414] text-[#F3F3EF]" : "text-[#52524E]"
              }`}
            >
              Daftar
            </button>
          </div>

          <h1 className="text-xl font-bold">
            {tab === "signup" ? "Buat akun desainer" : "Masuk ke SignOff"}
          </h1>

          {!configured && (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Mode lokal: Supabase belum diatur di <span className="font-mono-data">.env.local</span>. Kamu tetap bisa mencoba seluruh fitur lewat{" "}
              <Link href="/demo" className="font-bold underline">
                /demo
              </Link>
              .
            </div>
          )}

          {error && (
            <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-[#F43F5E]">
              {error}
            </p>
          )}
          {info && (
            <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {info}
            </p>
          )}

          <form onSubmit={handlePasswordAuth} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@studio.id"
                className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold">
                Password {tab === "signup" && <span className="font-normal text-[#787872]">(min 6 karakter)</span>}
              </label>
              <input
                type="password"
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[42px] w-full rounded bg-[#141414] text-sm font-semibold text-[#F3F3EF] disabled:opacity-50"
            >
              {busy ? "Memproses..." : tab === "signup" ? "Daftar" : "Masuk"}
            </button>
          </form>

          <button
            type="button"
            disabled={busy}
            onClick={handleMagicLink}
            className="mt-2.5 min-h-[40px] w-full rounded border border-[#C9C9C0] bg-white text-xs font-semibold text-[#141414] hover:bg-[#FAFAF8]"
          >
            Kirim magic link (tanpa password)
          </button>

          <div className="mt-4 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setTab("forgot");
                setError(null);
                setInfo(null);
              }}
              className="text-[#52524E] hover:underline"
            >
              Lupa password?
            </button>
            <Link href="/demo" className="font-semibold hover:underline">
              Coba /demo →
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold">Reset password</h1>
          <p className="mt-1 text-xs text-[#52524E]">
            Masukkan email untuk menerima link pengaturan ulang password.
          </p>
          {info && (
            <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {info}
            </p>
          )}
          <form onSubmit={handleForgot} className="mt-4 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@studio.id"
              className="min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[40px] w-full rounded bg-[#141414] text-sm font-semibold text-[#F3F3EF]"
            >
              {busy ? "Mengirim..." : "Kirim link reset"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setTab("login")}
            className="mt-3 w-full text-center text-xs text-[#52524E] hover:underline"
          >
            Kembali ke Masuk
          </button>
        </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F3F3EF] text-[#141414]">
      <header className="flex items-center justify-between border-b border-[#DFDFD8] bg-white px-4 py-3 sm:px-8">
        <Link href="/">
          <img src="/brand/signoff-lockup-light.svg" alt="SignOff" className="h-6 w-auto" />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <Suspense fallback={<div className="h-64 w-full max-w-md animate-pulse rounded-lg bg-white" />}>
          <LoginFormInner />
        </Suspense>
      </main>
    </div>
  );
}
