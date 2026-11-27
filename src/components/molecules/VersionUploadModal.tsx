"use client";

import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Trash2, UploadCloud } from "lucide-react";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

interface QueuedFrame {
  id: string;
  file: File;
  title: string;
  previewUrl: string;
  width: number;
  height: number;
}

interface VersionUploadModalProps {
  open: boolean;
  nextVersionNumber: number;
  initialNotes: string;
  onSubmitUpload: (formData: FormData) => Promise<void>;
  onClose: () => void;
}

function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1280, height: img.naturalHeight || 800 });
    img.onerror = () => resolve({ width: 1280, height: 800 });
    img.src = url;
  });
}

export function VersionUploadModal({
  open,
  nextVersionNumber,
  initialNotes,
  onSubmitUpload,
  onClose,
}: VersionUploadModalProps) {
  const [frames, setFrames] = useState<QueuedFrame[]>([]);
  const [notes, setNotes] = useState(initialNotes);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNotes(initialNotes);
      setWarnings([]);
      setError(null);
    }
  }, [open, initialNotes]);

  async function addFiles(fileList: FileList | File[]) {
    const nextWarnings: string[] = [];
    const added: QueuedFrame[] = [];

    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        nextWarnings.push(`"${file.name}" ditolak — gunakan PNG, JPG, atau WebP.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        nextWarnings.push(`"${file.name}" melebihi batas 10 MB.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      const dims = await readImageDimensions(previewUrl);
      const baseTitle = file.name.replace(/\.[^.]+$/, "") || `Frame ${frames.length + added.length + 1}`;
      added.push({
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        title: baseTitle,
        previewUrl,
        width: dims.width,
        height: dims.height,
      });
    }

    setWarnings(nextWarnings);
    if (added.length > 0) {
      setFrames((prev) => [...prev, ...added]);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedImages: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) pastedImages.push(f);
        }
      }
      if (pastedImages.length === 0) {
        setWarnings(["Clipboard tidak berisi gambar (hanya mendukung screenshot/gambar)."]);
        return;
      }
      void addFiles(pastedImages);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  if (!open) return null;

  function moveFrame(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= frames.length) return;
    setFrames((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (frames.length === 0 || uploading) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("notes", notes.trim());
      for (const fr of frames) {
        fd.append("files", fr.file);
        fd.append("titles", fr.title.trim() || "Frame");
        fd.append("widths", String(fr.width));
        fd.append("heights", String(fr.height));
      }
      await onSubmitUpload(fd);
      frames.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setFrames([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal. File tetap tersimpan untuk dicoba ulang.");
    } finally {
      setUploading(false);
    }
  }

  const titleCounts = new Map<string, number>();
  frames.forEach((f) => {
    const key = f.title.trim().toLowerCase();
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  });
  const hasDupTitles = Array.from(titleCounts.values()).some((c) => c > 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={() => {
        if (!uploading) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#C9C9C0] bg-white p-5 text-[#141414] shadow-xl"
      >
        <h2 className="text-base font-bold">
          Upload versi baru (<span className="font-mono-data">v{nextVersionNumber}</span>)
        </h2>
        <p className="mt-1 text-xs text-[#52524E]">
          Seret file <span className="font-mono-data">PNG/JPG/WebP</span> (maks 10 MB), pilih file, atau tekan{" "}
          <span className="font-mono-data">Ctrl+V</span> dari clipboard.
        </p>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
              void addFiles(e.dataTransfer.files);
            }
          }}
          className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-[#C9C9C0] bg-[#FAFAF8] p-6 text-center hover:border-[#141414]"
        >
          <UploadCloud className="mb-2 h-6 w-6 text-[#52524E]" />
          <span className="text-sm font-semibold">Klik pilih gambar atau seret ke sini</span>
          <span className="mt-0.5 text-xs text-[#787872]">Bisa langsung Ctrl+V screenshot</span>
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
            }}
          />
        </label>

        {warnings.length > 0 && (
          <div className="mt-3 space-y-1 rounded border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}

        {hasDupTitles && (
          <p className="mt-2 text-xs text-amber-700">
            Catatan: ada judul frame yang sama (diperbolehkan, tapi bisa membingungkan saat Before/After).
          </p>
        )}

        {frames.length > 0 && (
          <div className="mt-3 space-y-2">
            {frames.map((fr, idx) => (
              <div
                key={fr.id}
                className="flex items-center gap-2.5 rounded border border-[#DFDFD8] bg-[#FAFAF8] p-2"
              >
                <img
                  src={fr.previewUrl}
                  alt={fr.title}
                  className="h-11 w-14 shrink-0 rounded object-cover"
                />
                <input
                  value={fr.title}
                  onChange={(e) =>
                    setFrames((prev) =>
                      prev.map((item) =>
                        item.id === fr.id ? { ...item, title: e.target.value } : item
                      )
                    )
                  }
                  className="min-h-[34px] flex-1 rounded border border-[#C9C9C0] bg-white px-2 text-xs"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Geser ke atas"
                    disabled={idx === 0}
                    onClick={() => moveFrame(idx, -1)}
                    className="rounded p-1 text-[#52524E] disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Geser ke bawah"
                    disabled={idx === frames.length - 1}
                    onClick={() => moveFrame(idx, 1)}
                    className="rounded p-1 text-[#52524E] disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Hapus frame"
                    onClick={() => {
                      URL.revokeObjectURL(fr.previewUrl);
                      setFrames((prev) => prev.filter((item) => item.id !== fr.id));
                    }}
                    className="rounded p-1 text-[#F43F5E]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs font-semibold">Catatan rilis untuk klien</label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Apa yang berubah di versi ini..."
            className="mt-1 w-full rounded border border-[#C9C9C0] p-2.5 text-xs"
          />
        </div>

        {error && (
          <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-[#F43F5E]">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            className="min-h-[40px] rounded border border-[#C9C9C0] px-4 text-sm font-semibold"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={frames.length === 0 || uploading}
            className="min-h-[40px] rounded bg-[#141414] px-4 text-sm font-semibold text-[#F3F3EF] disabled:opacity-45"
          >
            {uploading ? "Mengunggah..." : `Simpan v${nextVersionNumber}`}
          </button>
        </div>
      </form>
    </div>
  );
}
