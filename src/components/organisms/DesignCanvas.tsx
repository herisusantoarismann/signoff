"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BoxSelect,
  Eye,
  EyeOff,
  Hand,
  MapPin,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";
import {
  clampZoom,
  clientPointToNormalized,
  computePinDisplayOffsets,
  dragRectToNormalizedBox,
} from "@/lib/canvas/coordinates";
import {
  PIN_CATEGORY_LABELS,
  PIN_STATUS_LABELS,
  type ClientMetaSnapshot,
  type DesignFrameRecord,
  type PinCategory,
  type PinKind,
  type PinRecord,
} from "@/lib/domain/types";

export type CanvasTool = "pin" | "box" | "pan";

export interface PendingPinInput {
  kind: PinKind;
  xNorm: number;
  yNorm: number;
  wNorm?: number;
  hNorm?: number;
  category: PinCategory;
  body: string;
  clientMeta: ClientMetaSnapshot;
}

interface DesignCanvasProps {
  frame: DesignFrameRecord | null;
  pins: PinRecord[];
  ghostPins?: PinRecord[];
  selectedPinId: string | null;
  locked: boolean;
  lockedReason?: string;
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  hideResolved: boolean;
  onToggleHideResolved: () => void;
  peekPreviousPins: boolean;
  canPeekPrevious: boolean;
  onTogglePeekPrevious: () => void;
  onSelectPin: (pinId: string) => void;
  onCreatePin: (input: PendingPinInput) => Promise<void> | void;
  focusTrigger?: number;
}

const STATUS_DOT_BG: Record<PinRecord["status"], string> = {
  open: "bg-[#F43F5E]",
  in_progress: "bg-[#3B82F6]",
  resolved: "bg-[#10B981]",
};

const BOX_BORDER_STYLE: Record<PinRecord["status"], string> = {
  open: "border-[#F43F5E] bg-[#F43F5E]/10",
  in_progress: "border-[#3B82F6] bg-[#3B82F6]/10",
  resolved: "border-[#10B981] bg-[#10B981]/10",
};

function captureClientMeta(): ClientMetaSnapshot {
  if (typeof window === "undefined") return { viewport: "Desktop" };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const prefix = w < 768 ? "Mobile" : "Desktop";
  return { viewport: `${prefix} ${w}×${h}` };
}

export function DesignCanvas({
  frame,
  pins,
  ghostPins = [],
  selectedPinId,
  locked,
  lockedReason,
  tool,
  onToolChange,
  hideResolved,
  onToggleHideResolved,
  peekPreviousPins,
  canPeekPrevious,
  onTogglePeekPrevious,
  onSelectPin,
  onCreatePin,
  focusTrigger = 0,
}: DesignCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [imgStatus, setImgStatus] = useState<"loading" | "ready" | "error">("loading");
  const [imgRetryKey, setImgRetryKey] = useState(0);

  const [dragBoxStart, setDragBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [dragBoxCur, setDragBoxCur] = useState<{ x: number; y: number } | null>(null);
  const [panDrag, setPanDrag] = useState<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const [composer, setComposer] = useState<{
    kind: PinKind;
    xNorm: number;
    yNorm: number;
    wNorm?: number;
    hNorm?: number;
  } | null>(null);
  const [composerCategory, setComposerCategory] = useState<PinCategory>("layout");
  const [composerBody, setComposerBody] = useState("");
  const [submittingPin, setSubmittingPin] = useState(false);

  const effectiveTool: CanvasTool = spaceHeld ? "pan" : locked && tool !== "pan" ? "pan" : tool;

  useEffect(() => {
    setImgStatus("loading");
    setComposer(null);
  }, [frame?.id]);

  // Hold Space for Pan, Esc to cancel composer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") {
          setComposer(null);
        }
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (e.key === "Escape") {
        setComposer(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Scroll/center selected pin when triggered from sidebar or deep link
  useEffect(() => {
    if (!selectedPinId || !stageRef.current || !surfaceRef.current) return;
    const pin = pins.find((p) => p.id === selectedPinId);
    if (!pin) return;
    const stage = stageRef.current;
    const surface = surfaceRef.current;
    const targetX = pin.x_norm * surface.offsetWidth * zoom - stage.clientWidth / 2;
    const targetY = pin.y_norm * surface.offsetHeight * zoom - stage.clientHeight / 2;
    stage.scrollTo({
      left: Math.max(0, targetX),
      top: Math.max(0, targetY),
      behavior: "smooth",
    });
  }, [selectedPinId, focusTrigger, pins, zoom]);

  const visiblePins = pins.filter((p) => !(hideResolved && p.status === "resolved"));
  const offsets = computePinDisplayOffsets(visiblePins);

  function handleFitZoom() {
    if (!stageRef.current || !frame) {
      setZoom(1);
      return;
    }
    const availW = Math.max(280, stageRef.current.clientWidth - 48);
    const naturalW = Math.min(820, Math.max(320, frame.width_px));
    setZoom(clampZoom(availW / naturalW));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-pin-ui]")) return;

    if (effectiveTool === "pan" && stageRef.current) {
      setPanDrag({
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: stageRef.current.scrollLeft,
        scrollTop: stageRef.current.scrollTop,
      });
      return;
    }

    if (locked || imgStatus !== "ready" || !surfaceRef.current) return;

    if (effectiveTool === "box") {
      setDragBoxStart({ x: e.clientX, y: e.clientY });
      setDragBoxCur({ x: e.clientX, y: e.clientY });
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (panDrag && stageRef.current) {
      stageRef.current.scrollLeft = panDrag.scrollLeft - (e.clientX - panDrag.startX);
      stageRef.current.scrollTop = panDrag.scrollTop - (e.clientY - panDrag.startY);
      return;
    }
    if (dragBoxStart) {
      setDragBoxCur({ x: e.clientX, y: e.clientY });
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (panDrag) {
      setPanDrag(null);
      return;
    }
    if (!surfaceRef.current || locked || imgStatus !== "ready") return;
    if ((e.target as HTMLElement).closest("[data-pin-ui]")) return;

    const rect = surfaceRef.current.getBoundingClientRect();

    if (effectiveTool === "box" && dragBoxStart) {
      const selection = dragRectToNormalizedBox(
        dragBoxStart,
        { x: e.clientX, y: e.clientY },
        rect
      );
      setDragBoxStart(null);
      setDragBoxCur(null);
      setComposer(selection);
      setComposerBody("");
      return;
    }

    if (effectiveTool === "pin") {
      const pt = clientPointToNormalized(e.clientX, e.clientY, rect);
      setComposer({ kind: "point", xNorm: pt.xNorm, yNorm: pt.yNorm });
      setComposerBody("");
    }
  }

  async function submitComposer(e: React.FormEvent) {
    e.preventDefault();
    if (!composer || !composerBody.trim() || submittingPin) return;
    setSubmittingPin(true);
    try {
      await onCreatePin({
        kind: composer.kind,
        xNorm: composer.xNorm,
        yNorm: composer.yNorm,
        wNorm: composer.wNorm,
        hNorm: composer.hNorm,
        category: composerCategory,
        body: composerBody.trim(),
        clientMeta: captureClientMeta(),
      });
      setComposer(null);
      setComposerBody("");
    } finally {
      setSubmittingPin(false);
    }
  }

  if (!frame) {
    return (
      <div className="canvas-grid-bg flex flex-1 items-center justify-center p-8 text-center text-slate-300">
        <p className="text-sm">Belum ada frame di versi ini.</p>
      </div>
    );
  }

  const imageSrc = frame.signed_url || frame.image_path;
  const baseWidthPx = Math.min(820, Math.max(300, frame.width_px));

  // Live drag box preview in normalized coordinates
  let liveBoxPreview: { left: number; top: number; width: number; height: number } | null = null;
  if (dragBoxStart && dragBoxCur && surfaceRef.current) {
    const sel = dragRectToNormalizedBox(
      dragBoxStart,
      dragBoxCur,
      surfaceRef.current.getBoundingClientRect(),
      0
    );
    if (sel.kind === "box") {
      liveBoxPreview = {
        left: sel.xNorm * 100,
        top: sel.yNorm * 100,
        width: sel.wNorm * 100,
        height: sel.hNorm * 100,
      };
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={stageRef}
        className="canvas-grid-bg relative flex-1 overflow-auto p-3 pb-36 sm:p-6 md:p-8 md:pb-24"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="mx-auto flex justify-center">
          <div
            ref={surfaceRef}
            data-testid="canvas-surface"
            style={{
              width: `${baseWidthPx}px`,
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
            }}
            className={`relative max-w-full select-none rounded-md shadow-2xl ${
              effectiveTool === "pin"
                ? "cursor-crosshair"
                : effectiveTool === "box"
                ? "cursor-cell"
                : "cursor-grab"
            }`}
          >
            {imgStatus === "loading" && (
              <div className="flex aspect-[16/10] w-full animate-pulse items-center justify-center rounded-md bg-slate-800 text-xs text-slate-400">
                Memuat gambar desain...
              </div>
            )}

            {imgStatus === "error" ? (
              <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 rounded-md border border-slate-700 bg-slate-900 p-6 text-center text-slate-300">
                <p className="text-sm">Gambar gagal dimuat.</p>
                <button
                  type="button"
                  onClick={() => {
                    setImgStatus("loading");
                    setImgRetryKey((k) => k + 1);
                  }}
                  className="rounded bg-[#F3F3EF] px-3 py-1.5 text-xs font-semibold text-[#141414]"
                >
                  Muat ulang gambar
                </button>
              </div>
            ) : (
              <img
                key={`${frame.id}-${imgRetryKey}`}
                src={imageSrc}
                alt={frame.title}
                onLoad={() => setImgStatus("ready")}
                onError={() => setImgStatus("error")}
                className={`block w-full rounded-md pointer-events-none ${
                  imgStatus === "ready" ? "opacity-100" : "h-0 opacity-0"
                }`}
              />
            )}

            {/* Ghost v1 Pins ("Intip Pin v1") */}
            {imgStatus === "ready" &&
              peekPreviousPins &&
              ghostPins.map((gp) => (
                <div
                  key={`ghost-${gp.id}`}
                  aria-hidden="true"
                  style={{
                    left: `${gp.x_norm * 100}%`,
                    top: `${gp.y_norm * 100}%`,
                  }}
                  className="font-mono-data pointer-events-none absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-[#F3F3EF]/75 bg-slate-900/65 text-[10px] font-bold text-[#F3F3EF] opacity-45"
                >
                  {gp.pin_number}
                </div>
              ))}

            {/* Active Frame Pins & Area Boxes */}
            {imgStatus === "ready" &&
              visiblePins.map((pin) => {
                const isSelected = selectedPinId === pin.id;
                const isDraft = pin.submitted_at === null;
                const nudge = offsets[pin.id] ?? { dx: 0, dy: 0 };

                if (pin.kind === "box" && pin.w_norm !== null && pin.h_norm !== null) {
                  return (
                    <div
                      key={pin.id}
                      data-pin-ui="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPin(pin.id);
                      }}
                      style={{
                        left: `${pin.x_norm * 100}%`,
                        top: `${pin.y_norm * 100}%`,
                        width: `${pin.w_norm * 100}%`,
                        height: `${pin.h_norm * 100}%`,
                      }}
                      className={`absolute z-10 cursor-pointer rounded border-2 border-dashed transition ${
                        BOX_BORDER_STYLE[pin.status]
                      } ${isSelected ? "ring-2 ring-[#F3F3EF] ring-offset-1 ring-offset-slate-900" : ""}`}
                    >
                      <button
                        type="button"
                        aria-label={`Pin ${pin.pin_number}, ${PIN_CATEGORY_LABELS[pin.category]}, ${PIN_STATUS_LABELS[pin.status]}, oleh ${pin.author_name}`}
                        className={`font-mono-data absolute -left-2 -top-3 flex h-6 min-w-[24px] items-center justify-center rounded-full border-2 px-1 text-[11px] font-bold text-white shadow ${
                          STATUS_DOT_BG[pin.status]
                        } ${isDraft ? "border-dashed border-[#F3F3EF]" : "border-white"}`}
                      >
                        {pin.pin_number}
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={pin.id}
                    type="button"
                    data-pin-ui="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPin(pin.id);
                    }}
                    aria-label={`Pin ${pin.pin_number}, ${PIN_CATEGORY_LABELS[pin.category]}, ${PIN_STATUS_LABELS[pin.status]}, oleh ${pin.author_name}`}
                    style={{
                      left: `${pin.x_norm * 100}%`,
                      top: `${pin.y_norm * 100}%`,
                      transform: `translate(calc(-50% + ${nudge.dx}px), calc(-50% + ${nudge.dy}px))`,
                    }}
                    className="absolute z-20 flex h-11 w-11 items-center justify-center bg-transparent p-0 focus:outline-none"
                  >
                    <span
                      className={`font-mono-data flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow-md transition ${
                        STATUS_DOT_BG[pin.status]
                      } ${isDraft ? "border-dashed border-[#F3F3EF]" : "border-white"} ${
                        isSelected ? "scale-115 ring-4 ring-[#F3F3EF]/35" : ""
                      }`}
                    >
                      {pin.pin_number}
                    </span>
                    {isDraft && (
                      <span className="absolute -right-2 -top-1 rounded border border-[#F3F3EF] bg-[#141414] px-1 text-[9px] font-bold text-[#F3F3EF]">
                        Draft
                      </span>
                    )}
                  </button>
                );
              })}

            {/* Live Drag Box Preview */}
            {liveBoxPreview && (
              <div
                style={{
                  left: `${liveBoxPreview.left}%`,
                  top: `${liveBoxPreview.top}%`,
                  width: `${liveBoxPreview.width}%`,
                  height: `${liveBoxPreview.height}%`,
                }}
                className="pointer-events-none absolute z-20 rounded border-2 border-dashed border-[#F43F5E] bg-[#F43F5E]/15"
              />
            )}

            {/* C04 Edge-Flipping Pin Composer Popover (bottom-docked on narrow phones, edge-flipped on sm+) */}
            {composer && (
              <form
                data-pin-ui="true"
                onSubmit={submitComposer}
                onClick={(e) => e.stopPropagation()}
                style={
                  {
                    "--cx": `${composer.xNorm > 0.6 ? Math.max(4, composer.xNorm * 100 - 34) : composer.xNorm * 100}%`,
                    "--cy": `${composer.yNorm > 0.65 ? Math.max(4, composer.yNorm * 100 - 30) : composer.yNorm * 100}%`,
                  } as React.CSSProperties
                }
                className="fixed inset-x-3 bottom-[124px] z-40 rounded-lg border border-[#141414] bg-white p-3 text-[#141414] shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-[var(--cx)] sm:top-[var(--cy)] sm:z-30 sm:w-72"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold">
                    {composer.kind === "box" ? "Catatan Area Box" : "Pin Baru"}
                  </span>
                  <span className="font-mono-data text-[10px] text-[#787872]">
                    {lockedReason || "Tekan Esc untuk batal"}
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {(Object.keys(PIN_CATEGORY_LABELS) as PinCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setComposerCategory(cat)}
                      className={`rounded px-2 py-0.5 text-[11px] font-medium border ${
                        composerCategory === cat
                          ? "border-[#141414] bg-[#141414] text-[#F3F3EF]"
                          : "border-[#DFDFD8] bg-[#F3F3EF] text-[#52524E]"
                      }`}
                    >
                      {PIN_CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
                <textarea
                  autoFocus
                  rows={3}
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  placeholder="Tulis revisi spesifik di titik ini..."
                  className="w-full rounded border border-[#C9C9C0] p-2 text-sm text-[#141414] focus:border-[#141414] focus:outline-none"
                />
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setComposer(null)}
                    className="min-h-[34px] rounded border border-[#C9C9C0] px-3 text-xs font-semibold text-[#141414]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!composerBody.trim() || submittingPin}
                    className="min-h-[34px] rounded bg-[#141414] px-3 text-xs font-semibold text-[#F3F3EF] disabled:opacity-45"
                  >
                    {submittingPin ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Floating Canvas Toolbar */}
      <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-20 flex justify-center px-2 sm:px-3 md:bottom-4">
        <div
          aria-label="Alat kanvas"
          className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border border-slate-700 bg-[#1E293B] px-2 py-1.5 text-xs text-slate-200 shadow-2xl"
        >
          {!locked && (
            <>
              <button
                type="button"
                onClick={() => onToolChange("pin")}
                className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 font-semibold ${
                  effectiveTool === "pin"
                    ? "bg-[#F3F3EF] text-[#141414]"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Pin</span>
              </button>
              <button
                type="button"
                onClick={() => onToolChange("box")}
                className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 font-semibold ${
                  effectiveTool === "box"
                    ? "bg-[#F3F3EF] text-[#141414]"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <BoxSelect className="h-3.5 w-3.5" />
                <span>Box</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onToolChange("pan")}
            className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 font-semibold ${
              effectiveTool === "pan"
                ? "bg-[#F3F3EF] text-[#141414]"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Hand className="h-3.5 w-3.5" />
            <span>Geser</span>
          </button>

          <span className="mx-0.5 h-4 w-px bg-slate-700" />

          <button
            type="button"
            aria-label="Perkecil"
            onClick={() => setZoom((z) => clampZoom(z - 0.25))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono-data min-w-[44px] text-center text-[11px] font-semibold">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Perbesar"
            onClick={() => setZoom((z) => clampZoom(z + 0.25))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Fit layar"
            onClick={handleFitZoom}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          <span className="mx-0.5 h-4 w-px bg-slate-700" />

          <button
            type="button"
            onClick={onToggleHideResolved}
            className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 font-semibold ${
              hideResolved
                ? "bg-[#F3F3EF] text-[#141414]"
                : "text-slate-300 hover:text-white"
            }`}
          >
            {hideResolved ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>{hideResolved ? "Tampilkan Resolved" : "Sembunyikan Resolved"}</span>
          </button>

          {canPeekPrevious && (
            <button
              type="button"
              onClick={onTogglePeekPrevious}
              className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 font-semibold ${
                peekPreviousPins
                  ? "bg-[#F3F3EF] text-[#141414]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Intip Pin v1
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
