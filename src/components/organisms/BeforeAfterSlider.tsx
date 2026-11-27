"use client";

import React, { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import type { DesignFrameRecord, DesignVersionRecord } from "@/lib/domain/types";

interface BeforeAfterSliderProps {
  open: boolean;
  versions: DesignVersionRecord[];
  frames: DesignFrameRecord[];
  initialFrameTitle?: string;
  onClose: () => void;
}

export function BeforeAfterSlider({
  open,
  versions,
  frames,
  initialFrameTitle,
  onClose,
}: BeforeAfterSliderProps) {
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => a.version_number - b.version_number),
    [versions]
  );

  const [beforeVersionId, setBeforeVersionId] = useState<string>(
    sortedVersions[0]?.id ?? ""
  );
  const [afterVersionId, setAfterVersionId] = useState<string>(
    sortedVersions[sortedVersions.length - 1]?.id ?? ""
  );
  const [split, setSplit] = useState(50);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const frameTitles = useMemo(() => {
    const titles = new Set<string>();
    frames.forEach((f) => titles.add(f.title));
    return Array.from(titles);
  }, [frames]);

  const [selectedTitle, setSelectedTitle] = useState<string>(
    initialFrameTitle || frameTitles[0] || ""
  );

  if (!open) return null;

  const activeTitle = frameTitles.includes(selectedTitle)
    ? selectedTitle
    : frameTitles[0] || "";

  const beforeVersion = sortedVersions.find((v) => v.id === beforeVersionId) ?? sortedVersions[0];
  const afterVersion =
    sortedVersions.find((v) => v.id === afterVersionId) ??
    sortedVersions[sortedVersions.length - 1];

  const beforeFrame = frames.find(
    (f) => f.version_id === beforeVersion?.id && f.title === activeTitle
  );
  const afterFrame = frames.find(
    (f) => f.version_id === afterVersion?.id && f.title === activeTitle
  );

  const dimensionMismatch =
    beforeFrame &&
    afterFrame &&
    Math.abs(
      beforeFrame.width_px / beforeFrame.height_px -
        afterFrame.width_px / afterFrame.height_px
    ) > 0.03;

  function updateFromPointer(clientX: number) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.min(98, Math.max(2, ((clientX - rect.left) / rect.width) * 100));
    setSplit(Math.round(pct));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Perbandingan Before After"
        className="w-full max-w-4xl rounded-xl border border-slate-700 bg-[#0F172A] p-4 text-[#F8FAFC] shadow-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold">Bandingkan Before / After</h2>
            <p className="text-xs text-slate-400">
              Geser pembatas tengah atau pakai tombol panah kiri/kanan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup perbandingan"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-400">Before:</span>
            <select
              value={beforeVersion?.id ?? ""}
              onChange={(e) => setBeforeVersionId(e.target.value)}
              className="font-mono-data rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-white"
            >
              {sortedVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-400">After:</span>
            <select
              value={afterVersion?.id ?? ""}
              onChange={(e) => setAfterVersionId(e.target.value)}
              className="font-mono-data rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-white"
            >
              {sortedVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-400">Frame:</span>
            <select
              value={activeTitle}
              onChange={(e) => setSelectedTitle(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-white"
            >
              {frameTitles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        {dimensionMismatch && (
          <p className="mt-2 rounded border border-amber-800 bg-amber-950/60 px-3 py-1.5 text-xs text-amber-200">
            Rasio tinggi kedua frame berbeda; diselaraskan pada lebar yang sama.
          </p>
        )}

        <div className="mt-4 max-h-[68vh] overflow-auto">
          {!beforeFrame || !afterFrame ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-300">
              Frame &ldquo;{activeTitle}&rdquo; hanya ada di salah satu versi. Pilih frame lain di atas.
            </div>
          ) : (
            <div
              ref={containerRef}
              tabIndex={0}
              role="slider"
              aria-label="Pembatas Before After"
              aria-valuemin={2}
              aria-valuemax={98}
              aria-valuenow={split}
              onPointerMove={(e) => {
                if (dragging) updateFromPointer(e.clientX);
              }}
              onPointerUp={() => setDragging(false)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setSplit((s) => Math.max(2, s - 4));
                if (e.key === "ArrowRight") setSplit((s) => Math.min(98, s + 4));
              }}
              className="relative mx-auto w-full max-w-3xl select-none overflow-hidden rounded-lg border border-slate-700 focus:outline-none"
            >
              <img
                src={afterFrame.signed_url || afterFrame.image_path}
                alt={`After ${afterVersion?.label}`}
                className="pointer-events-none block w-full"
              />
              <div
                data-testid="before-after-overlay"
                style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                className="absolute inset-0"
              >
                <img
                  src={beforeFrame.signed_url || beforeFrame.image_path}
                  alt={`Before ${beforeVersion?.label}`}
                  className="pointer-events-none block w-full"
                />
              </div>
              <div
                onPointerDown={(e) => {
                  setDragging(true);
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                }}
                style={{ left: `${split}%` }}
                className="absolute bottom-0 top-0 z-10 w-0.5 cursor-ew-resize bg-[#F3F3EF] shadow-[0_0_0_1px_#141414]"
              >
                <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#F3F3EF] bg-[#141414] text-[#F3F3EF] shadow-lg">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
              </div>
              <span className="font-mono-data absolute left-2.5 top-2.5 rounded bg-[#141414]/85 px-2 py-0.5 text-[11px] font-semibold text-[#F3F3EF]">
                {beforeVersion?.label} (Before)
              </span>
              <span className="font-mono-data absolute right-2.5 top-2.5 rounded bg-[#141414]/85 px-2 py-0.5 text-[11px] font-semibold text-[#F3F3EF]">
                {afterVersion?.label} (After)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
