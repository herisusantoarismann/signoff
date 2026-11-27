"use client";

import React, { useState } from "react";
import { Shuffle } from "lucide-react";

interface CreateProjectModalProps {
  open: boolean;
  onCreated: (projectId: string) => void;
  onClose: () => void;
}

export function CreateProjectModal({ open, onCreated, onClose }: CreateProjectModalProps) {
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [usePasscode, setUsePasscode] = useState(false);
  const [passcode, setPasscode] = useState("4821");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function randomizePasscode() {
    setPasscode(String(Math.floor(1000 + Math.random() * 9000)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Judul proyek wajib diisi.");
      return;
    }
    if (usePasscode && !/^\d{4}$/.test(passcode)) {
      setError("Passcode harus tepat 4 digit angka.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          client_name: clientName.trim() || null,
          passcode: usePasscode ? passcode : "",
          review_due_at: deadline ? new Date(`${deadline}T23:59:00`).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat proyek.");
        return;
      }
      setTitle("");
      setClientName("");
      onCreated(data.project.id);
    } catch {
      setError("Koneksi gagal. Data form tetap tersimpan, coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg border border-[#C9C9C0] bg-white p-5 text-[#141414] shadow-xl"
      >
        <h2 className="text-base font-bold">Buat proyek baru</h2>

        {error && (
          <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-[#F43F5E]">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold">Judul proyek *</label>
            <input
              autoFocus
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Misal: Redesign Landing Page KopiKita"
              className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold">Nama klien (opsional)</label>
            <input
              maxLength={80}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Misal: Budi · KopiKita"
              className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
            />
          </div>

          <div className="rounded border border-[#DFDFD8] bg-[#FAFAF8] p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={usePasscode}
                onChange={(e) => setUsePasscode(e.target.checked)}
                className="h-4 w-4 accent-[#141414]"
              />
              Aktifkan passcode 4 digit untuk link klien
            </label>
            {usePasscode && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="font-mono-data min-h-[38px] w-28 rounded border border-[#C9C9C0] bg-white px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={randomizePasscode}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded border border-[#C9C9C0] bg-white px-2.5 text-xs font-semibold"
                >
                  <Shuffle className="h-3.5 w-3.5" /> Acak
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold">Tenggat review (opsional)</label>
            <input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
            />
          </div>
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
            type="submit"
            disabled={busy}
            className="min-h-[40px] rounded bg-[#141414] px-4 text-sm font-semibold text-[#F3F3EF] disabled:opacity-45"
          >
            {busy ? "Membuat..." : "Buat proyek"}
          </button>
        </div>
      </form>
    </div>
  );
}
