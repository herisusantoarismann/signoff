"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OwnerHeader } from "@/components/organisms/OwnerHeader";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";

export default function SettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [studioName, setStudioName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/account").then(async (res) => {
      if (res.status === 401) {
        router.replace("/login?next=/settings");
        return;
      }
      if (res.ok) {
        const d = await res.json();
        setEmail(d.email ?? "");
        setStudioName(d.studio_name ?? "");
      }
    });
  }, [router]);

  async function saveStudio(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio_name: studioName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ message: data.error || "Gagal menyimpan profil.", tone: "error" });
        return;
      }
      showToast({ message: "Nama studio diperbarui.", tone: "success" });
    } finally {
      setBusy(false);
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createBrowserSupabaseClient();
    if (!supabase || !newEmail.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) {
        showToast({ message: error.message, tone: "error" });
        return;
      }
      showToast({
        message: `Menunggu konfirmasi di ${newEmail.trim()}`,
        tone: "info",
      });
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast({ message: "Password baru minimal 6 karakter.", tone: "error" });
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showToast({ message: error.message, tone: "error" });
        return;
      }
      setNewPassword("");
      showToast({ message: "Password diperbarui.", tone: "success" });
    } finally {
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut({ scope: "global" });
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmDeleteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ message: data.error || "Gagal menghapus akun.", tone: "error" });
        return;
      }
      const supabase = createBrowserSupabaseClient();
      if (supabase) await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F3F3EF] text-[#141414]">
      <OwnerHeader breadcrumb="Pengaturan Akun" accountLabel={studioName || email || "Akun"} />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Akun</h1>

        <form onSubmit={saveStudio} className="rounded-lg border border-[#DFDFD8] bg-white p-5">
          <h2 className="text-base font-bold">Profil Studio</h2>
          <label className="mt-3 block text-xs font-semibold">
            Nama studio (tampil ke klien pada halaman join &amp; link nonaktif)
          </label>
          <input
            maxLength={60}
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            placeholder="Misal: Raka Studio"
            className="mt-1.5 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
          />
          <p className="mt-2 text-xs text-[#787872]">
            Preview klien:{" "}
            <strong>
              {studioName.trim()
                ? `"${studioName.trim()} mengundang kamu mereview"`
                : '"Kamu diundang untuk mereview proyek ini"'}
            </strong>
          </p>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 min-h-[38px] rounded bg-[#141414] px-4 text-xs font-semibold text-[#F3F3EF]"
          >
            Simpan profil
          </button>
        </form>

        <form onSubmit={changeEmail} className="rounded-lg border border-[#DFDFD8] bg-white p-5">
          <h2 className="text-base font-bold">Email</h2>
          <p className="font-mono-data mt-1 text-xs text-[#52524E]">Saat ini: {email || "-"}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email baru"
              className="min-h-[40px] flex-1 rounded border border-[#C9C9C0] px-3 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !newEmail.trim()}
              className="min-h-[40px] rounded border border-[#C9C9C0] px-4 text-xs font-semibold disabled:opacity-45"
            >
              Ganti email
            </button>
          </div>
        </form>

        <form onSubmit={changePassword} className="rounded-lg border border-[#DFDFD8] bg-white p-5">
          <h2 className="text-base font-bold">Password</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password baru (min 6 karakter)"
              className="min-h-[40px] flex-1 rounded border border-[#C9C9C0] px-3 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[40px] rounded border border-[#C9C9C0] px-4 text-xs font-semibold"
            >
              Simpan password
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-[#DFDFD8] bg-white p-5">
          <h2 className="text-base font-bold">Sesi Aktif</h2>
          <button
            type="button"
            onClick={signOutEverywhere}
            className="mt-3 min-h-[38px] rounded border border-[#C9C9C0] px-4 text-xs font-semibold hover:bg-[#FAFAF8]"
          >
            Keluar dari semua perangkat
          </button>
        </div>

        <div className="rounded-lg border border-rose-300 bg-white p-5">
          <h2 className="text-base font-bold text-[#F43F5E]">Zona Bahaya</h2>
          <p className="mt-1 text-xs text-[#52524E]">
            Menghapus akun akan menghapus permanen seluruh proyek dan gambar di Storage.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="mt-3 min-h-[38px] rounded border border-rose-300 px-4 text-xs font-semibold text-[#F43F5E] hover:bg-rose-50"
          >
            Hapus akun permanen
          </button>
        </div>
      </main>

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-5 shadow-xl"
          >
            <h2 className="text-base font-bold text-[#F43F5E]">Konfirmasi hapus akun</h2>
            <p className="mt-2 text-xs text-[#52524E]">
              Ketik email akun kamu (<span className="font-mono-data">{email}</span>) untuk menghapus akun dan semua proyek secara permanen.
            </p>
            <input
              value={confirmDeleteEmail}
              onChange={(e) => setConfirmDeleteEmail(e.target.value)}
              placeholder={email}
              className="mt-3 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="min-h-[38px] rounded border border-[#C9C9C0] px-4 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy || confirmDeleteEmail.trim().toLowerCase() !== email.toLowerCase()}
                onClick={deleteAccount}
                className="min-h-[38px] rounded bg-[#F43F5E] px-4 text-xs font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Menghapus..." : "Hapus akun"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
