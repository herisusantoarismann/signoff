"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Columns2, MessageSquare, Share2, Upload } from "lucide-react";
import { DesignCanvas, type CanvasTool, type PendingPinInput } from "@/components/organisms/DesignCanvas";
import { BeforeAfterSlider } from "@/components/organisms/BeforeAfterSlider";
import { ThreadSidebar } from "@/components/organisms/ThreadSidebar";
import { ApprovalDialog } from "@/components/molecules/ApprovalDialog";
import { RecordApprovalDialog } from "@/components/molecules/RecordApprovalDialog";
import { CopyWaSummaryModal } from "@/components/molecules/CopyWaSummaryModal";
import { PresenceAvatars, type PresenceMember } from "@/components/atoms/PresenceAvatars";
import { ConnectionBanner, type ConnectionState } from "@/components/atoms/ConnectionBanner";
import { ShortcutHelpModal } from "@/components/molecules/ShortcutHelpModal";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { buildAutoReleaseNotes } from "@/lib/utils/release-notes";
import { formatDeadlineDate, formatIndonesianDateTime, getDeadlineState } from "@/lib/utils/dates";
import type {
  ApprovalSource,
  PinRecord,
  PinStatus,
  ReviewBundle,
} from "@/lib/domain/types";

interface ReviewWorkspaceProps {
  bundle: ReviewBundle;
  mode: "owner" | "client" | "demo";
  presenceMembers?: PresenceMember[];
  connectionState?: ConnectionState;
  latestBroadcastVersionLabel?: string | null;
  onDismissNewVersionBanner?: () => void;
  onCreatePin: (frameId: string, input: PendingPinInput) => Promise<PinRecord | void>;
  onSubmitDrafts?: () => Promise<{ submittedCount: number; byVersion?: Record<string, number> } | void>;
  onChangePinStatus: (pinId: string, status: PinStatus) => Promise<void>;
  onDeletePin: (pinId: string) => Promise<void>;
  onAddReply: (pinId: string, body: string) => Promise<void>;
  onEditComment: (commentId: string, body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onApproveVersion?: (versionId: string, confirmName: string) => Promise<void>;
  onRecordApproval?: (versionId: string, data: { clientName: string; source: ApprovalSource; note: string }) => Promise<void>;
  onOpenUploadModal?: () => void;
  onOpenShareModal?: () => void;
  onSwitchVersionStatus?: (versionId: string, nextStatus: "in_review" | "changes_requested") => Promise<void>;
  onRenameFrame?: (versionId: string, frameId: string, title: string) => Promise<void>;
  topSlot?: React.ReactNode;
  initialFrameId?: string | null;
  initialPinId?: string | null;
}

export function ReviewWorkspace({
  bundle,
  mode,
  presenceMembers = [],
  connectionState = "connected",
  latestBroadcastVersionLabel = null,
  onDismissNewVersionBanner,
  onCreatePin,
  onSubmitDrafts,
  onChangePinStatus,
  onDeletePin,
  onAddReply,
  onEditComment,
  onDeleteComment,
  onApproveVersion,
  onRecordApproval,
  onOpenUploadModal,
  onOpenShareModal,
  onSwitchVersionStatus,
  onRenameFrame,
  topSlot,
  initialFrameId,
  initialPinId,
}: ReviewWorkspaceProps) {
  const { showToast } = useToast();
  const isOwner = bundle.actor.role === "owner";

  const sortedVersions = useMemo(
    () => [...bundle.versions].sort((a, b) => a.version_number - b.version_number),
    [bundle.versions]
  );
  const latestVersion = sortedVersions[sortedVersions.length - 1] ?? null;

  const [activeVersionId, setActiveVersionId] = useState<string>(
    latestVersion?.id ?? ""
  );
  const activeVersion =
    sortedVersions.find((v) => v.id === activeVersionId) ?? latestVersion;

  const versionFrames = useMemo(
    () =>
      bundle.frames
        .filter((f) => f.version_id === activeVersion?.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [bundle.frames, activeVersion?.id]
  );

  const [activeFrameId, setActiveFrameId] = useState<string>(
    initialFrameId || versionFrames[0]?.id || ""
  );
  const activeFrame =
    versionFrames.find((f) => f.id === activeFrameId) ?? versionFrames[0] ?? null;

  const [selectedPinId, setSelectedPinId] = useState<string | null>(initialPinId ?? null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [tool, setTool] = useState<CanvasTool>("pin");
  const [hideResolved, setHideResolved] = useState(false);
  const [peekPrevious, setPeekPrevious] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const [showCompare, setShowCompare] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRecordAccModal, setShowRecordAccModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [deletePinConfirmId, setDeletePinConfirmId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // Previous version matching frame for "Intip Pin v1"
  const previousVersion = activeVersion
    ? sortedVersions.find((v) => v.version_number === activeVersion.version_number - 1) ?? null
    : null;
  const previousMatchingFrame =
    previousVersion && activeFrame
      ? bundle.frames.find(
          (f) => f.version_id === previousVersion.id && f.title === activeFrame.title
        ) ?? null
      : null;
  const ghostPins = previousMatchingFrame
    ? bundle.pins.filter((p) => p.frame_id === previousMatchingFrame.id && p.submitted_at !== null)
    : [];

  const framePins = useMemo(
    () => bundle.pins.filter((p) => p.frame_id === activeFrame?.id),
    [bundle.pins, activeFrame?.id]
  );

  const versionFrameIds = useMemo(
    () => new Set(versionFrames.map((f) => f.id)),
    [versionFrames]
  );
  const versionPins = useMemo(
    () => bundle.pins.filter((p) => versionFrameIds.has(p.frame_id)),
    [bundle.pins, versionFrameIds]
  );

  const draftCount = bundle.pins.filter((p) => p.submitted_at === null).length;
  const isArchived = Boolean(bundle.project.archived_at);
  const isOlderVersion = Boolean(
    activeVersion && latestVersion && activeVersion.id !== latestVersion.id
  );
  const locked =
    isArchived || isOlderVersion || activeVersion?.status === "approved";

  // Keep selected frame valid when switching versions
  useEffect(() => {
    if (versionFrames.length > 0 && !versionFrames.some((f) => f.id === activeFrameId)) {
      setActiveFrameId(versionFrames[0].id);
    }
  }, [versionFrames, activeFrameId]);

  // Warn before leaving if client has unsent draft pins
  useEffect(() => {
    if (isOwner || draftCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isOwner, draftCount]);

  // Desktop keyboard shortcuts (P, B, N, Shift+N, R, ?)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?") {
        setShowShortcuts(true);
      } else if (e.key.toLowerCase() === "p" && !locked) {
        setTool("pin");
      } else if (e.key.toLowerCase() === "b" && !locked) {
        setTool("box");
      } else if (e.key.toLowerCase() === "n" && framePins.length > 0) {
        const idx = framePins.findIndex((p) => p.id === selectedPinId);
        const nextIdx = e.shiftKey
          ? (idx <= 0 ? framePins.length - 1 : idx - 1)
          : (idx + 1) % framePins.length;
        setSelectedPinId(framePins[nextIdx].id);
        setFocusTrigger((n) => n + 1);
      } else if (e.key.toLowerCase() === "r" && isOwner && !locked && selectedPinId) {
        void onChangePinStatus(selectedPinId, "resolved");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, framePins, selectedPinId, isOwner, onChangePinStatus]);

  const deadlineState = getDeadlineState(bundle.project.review_due_at);

  function handleSelectPin(pinId: string) {
    setSelectedPinId(pinId);
    setFocusTrigger((n) => n + 1);
    setMobileSheetOpen(true);
  }

  async function handleCopyPinLink(pin: PinRecord) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("frame", pin.frame_id);
    url.searchParams.set("pin", pin.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast({ message: `Link Pin #${pin.pin_number} disalin`, tone: "success" });
    } catch {
      showToast({ message: "Gagal menyalin link.", tone: "error" });
    }
  }

  async function handleSubmitDraftsClick() {
    if (!onSubmitDrafts) return;
    setBusyAction(true);
    try {
      const res = await onSubmitDrafts();
      const count = res && "submittedCount" in res ? res.submittedCount : draftCount;
      showToast({ message: `${count} feedback berhasil dikirim.`, tone: "success" });
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0F172A] text-[#F8FAFC]">
      {topSlot}
      <ConnectionBanner state={connectionState} />

      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#111827] px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
          <Link
            href={mode === "owner" ? "/dashboard" : "/"}
            aria-label="Kembali"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded p-1 hover:bg-slate-800"
          >
            {mode === "owner" && <ArrowLeft className="h-4 w-4 text-slate-300" />}
            <img src="/brand/signoff-mark-inverse.svg" alt="SignOff" className="h-5 w-5" />
          </Link>

          <strong className="max-w-[140px] truncate text-sm font-bold sm:max-w-[220px] lg:max-w-xs">
            {bundle.project.title}
          </strong>

          <div className="flex max-w-full items-center gap-1 overflow-x-auto">
            {sortedVersions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveVersionId(v.id)}
                className={`font-mono-data rounded px-2 py-1 text-xs font-semibold ${
                  v.id === activeVersion?.id
                    ? "bg-[#F3F3EF] text-[#141414]"
                    : "border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                }`}
              >
                {v.label}
                {v.status === "approved" ? " ✓" : ""}
              </button>
            ))}
          </div>

          <PresenceAvatars members={presenceMembers} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {sortedVersions.length >= 2 && (
            <button
              type="button"
              onClick={() => setShowCompare(true)}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span>Bandingkan</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowWaModal(true)}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Copy WA</span>
          </button>

          {isOwner ? (
            <>
              {onOpenShareModal && (
                <button
                  type="button"
                  onClick={onOpenShareModal}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Bagikan</span>
                </button>
              )}
              {onOpenUploadModal && !isArchived && (
                <button
                  type="button"
                  onClick={onOpenUploadModal}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded bg-[#F3F3EF] px-3 text-xs font-bold text-[#141414] hover:bg-white"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload versi baru</span>
                </button>
              )}
              {!isOlderVersion &&
                !isArchived &&
                activeVersion?.status === "in_review" &&
                onRecordApproval && (
                  <button
                    type="button"
                    onClick={() => setShowRecordAccModal(true)}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-slate-600 px-2.5 text-xs font-semibold text-slate-200 hover:border-slate-400"
                  >
                    Catat ACC
                  </button>
                )}
            </>
          ) : (
            !isOlderVersion &&
            !isArchived &&
            activeVersion && (
              <button
                type="button"
                disabled={activeVersion.status !== "in_review"}
                onClick={() => setShowApproveModal(true)}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded px-3 text-xs font-bold transition ${
                  activeVersion.status === "approved"
                    ? "bg-[#10B981] text-white"
                    : "border border-slate-600 bg-[#141414] text-[#F3F3EF] hover:bg-neutral-800"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {activeVersion.status === "approved" ? "Sudah ACC" : "Approve Versi Ini"}
              </button>
            )
          )}
        </div>
      </header>

      {/* Banners */}
      {latestBroadcastVersionLabel && (
        <div className="flex items-center justify-between bg-slate-800 px-4 py-2 text-xs text-slate-100">
          <span>
            Versi baru <strong className="font-mono-data">{latestBroadcastVersionLabel}</strong> sudah tersedia.
          </span>
          <div className="flex gap-2">
            {latestVersion && (
              <button
                type="button"
                onClick={() => {
                  setActiveVersionId(latestVersion.id);
                  onDismissNewVersionBanner?.();
                }}
                className="rounded bg-[#F3F3EF] px-2.5 py-1 font-semibold text-[#141414]"
              >
                Lihat {latestVersion.label}
              </button>
            )}
            <button
              type="button"
              onClick={onDismissNewVersionBanner}
              className="text-slate-400 hover:text-white"
            >
              Nanti
            </button>
          </div>
        </div>
      )}

      {deadlineState !== "none" && activeVersion?.status !== "approved" && bundle.project.review_due_at && (
        <div
          className={`flex items-center justify-between px-4 py-1.5 text-xs ${
            deadlineState === "soon" || deadlineState === "past"
              ? "bg-amber-100 text-amber-900"
              : "bg-slate-900 text-slate-300 border-b border-slate-800"
          }`}
        >
          <span>
            {deadlineState === "past"
              ? "Tenggat review sudah lewat"
              : `Mohon review sebelum ${formatDeadlineDate(bundle.project.review_due_at)}`}
          </span>
          <span className="font-mono-data">{activeVersion?.label}</span>
        </div>
      )}

      {isArchived && (
        <div className="bg-slate-800 px-4 py-2 text-xs text-slate-200">
          Proyek ini sudah diarsip — mode lihat saja (read-only).
        </div>
      )}

      {activeVersion?.status === "approved" && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs ${
            activeVersion.approval_method === "owner_recorded"
              ? "bg-[#F3F3EF] text-[#141414]"
              : "bg-emerald-950/90 text-emerald-100 border-b border-emerald-800"
          }`}
        >
          <span>
            {activeVersion.approval_method === "owner_recorded" ? (
              <>
                <strong>Dicatat oleh desainer:</strong> {activeVersion.approval_statement}{" "}
                {activeVersion.approval_note && `(${activeVersion.approval_note})`}
              </>
            ) : (
              <>
                <strong>
                  Disetujui oleh {activeVersion.approved_by_name}
                </strong>{" "}
                ·{" "}
                <span className="font-mono-data">
                  {activeVersion.approved_at ? formatIndonesianDateTime(activeVersion.approved_at) : ""}
                </span>{" "}
                — &ldquo;{activeVersion.approval_statement}&rdquo;
              </>
            )}
          </span>
          <span className="opacity-80">
            Ada perubahan lanjutan? {isOwner ? "Upload versi baru." : `Hubungi desainer untuk v${(latestVersion?.version_number ?? 1) + 1}.`}
          </span>
        </div>
      )}

      {isOlderVersion && activeVersion?.status !== "approved" && latestVersion && (
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-300">
          <span>
            Kamu sedang melihat versi lama (<span className="font-mono-data">{activeVersion?.label}</span>, read-only).
          </span>
          <button
            type="button"
            onClick={() => setActiveVersionId(latestVersion.id)}
            className="rounded border border-slate-600 px-2.5 py-1 font-semibold text-white"
          >
            Lihat versi terbaru ({latestVersion.label})
          </button>
        </div>
      )}

      {/* Main Split Area */}
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        {/* Frame Rail: top horizontal strip on mobile/tablet, left column on desktop (lg+) */}
        {versionFrames.length > 0 && (
          <aside
            aria-label="Daftar frame"
            className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-800 bg-[#131C2E] p-2 sm:p-2.5 lg:w-44 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r"
          >
            <div className="hidden items-center justify-between px-1 text-[11px] font-semibold text-slate-400 lg:flex">
              <span>FRAMES ({activeVersion?.label})</span>
              {isOwner && activeVersion && activeVersion.status !== "approved" && onSwitchVersionStatus && (
                <button
                  type="button"
                  onClick={() =>
                    onSwitchVersionStatus(
                      activeVersion.id,
                      activeVersion.status === "changes_requested"
                        ? "in_review"
                        : "changes_requested"
                    )
                  }
                  className="text-[10px] underline"
                >
                  {activeVersion.status === "changes_requested" ? "Set Review" : "Set Revisi"}
                </button>
              )}
            </div>
            {versionFrames.map((fr) => {
              const openCount = bundle.pins.filter(
                (p) => p.frame_id === fr.id && p.submitted_at !== null && p.status === "open"
              ).length;
              return (
                <button
                  key={fr.id}
                  type="button"
                  onClick={() => setActiveFrameId(fr.id)}
                  onDoubleClick={() => {
                    if (!isOwner || !onRenameFrame || !activeVersion) return;
                    const nextTitle = window.prompt("Ubah nama frame:", fr.title);
                    if (nextTitle && nextTitle.trim()) {
                      void onRenameFrame(activeVersion.id, fr.id, nextTitle.trim());
                    }
                  }}
                  className={`w-28 shrink-0 rounded border p-1.5 text-left transition sm:w-32 lg:w-full ${
                    fr.id === activeFrame?.id
                      ? "border-[#F3F3EF] bg-[#1E293B]"
                      : "border-slate-800 bg-slate-900 hover:border-slate-600"
                  }`}
                >
                  <img
                    src={fr.signed_url || fr.image_path}
                    alt={fr.title}
                    className="mb-1 h-12 w-full rounded object-cover sm:h-14 lg:mb-1.5 lg:h-16"
                  />
                  <p className="truncate text-[11px] font-semibold text-slate-100">{fr.title}</p>
                  <p className="font-mono-data text-[10px] text-slate-400">{openCount} open</p>
                </button>
              );
            })}
          </aside>
        )}

        {/* Canvas */}
        {versionFrames.length === 0 && isOwner && onOpenUploadModal ? (
          <div className="canvas-grid-bg flex flex-1 flex-col items-center justify-center p-8 text-center">
            <h2 className="text-lg font-bold text-white">Belum ada desain diunggah</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-300">
              Unggah screenshot atau mockup PNG/JPG/WebP (bisa drag-drop atau Ctrl+V) untuk mulai menerima feedback.
            </p>
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded bg-[#F3F3EF] px-4 text-sm font-bold text-[#141414]"
            >
              <Upload className="h-4 w-4" /> Upload versi pertama (v1)
            </button>
          </div>
        ) : (
          <DesignCanvas
            frame={activeFrame}
            pins={framePins}
            ghostPins={ghostPins}
            selectedPinId={selectedPinId}
            locked={locked}
            lockedReason={isOwner ? "Langsung tayang" : "Disimpan ke Draft"}
            tool={tool}
            onToolChange={setTool}
            hideResolved={hideResolved}
            onToggleHideResolved={() => setHideResolved((v) => !v)}
            peekPreviousPins={peekPrevious}
            canPeekPrevious={Boolean(previousMatchingFrame)}
            onTogglePeekPrevious={() => setPeekPrevious((v) => !v)}
            onSelectPin={handleSelectPin}
            onCreatePin={async (input) => {
              if (!activeFrame) return;
              const created = await onCreatePin(activeFrame.id, input);
              if (created) {
                setSelectedPinId(created.id);
              }
            }}
            focusTrigger={focusTrigger}
          />
        )}
        </div>

        {/* Thread Sidebar & Mobile Bottom Sheet */}
        <ThreadSidebar
          pins={framePins}
          activities={bundle.activities}
          versionNotes={activeVersion?.notes || ""}
          versionLabel={activeVersion?.label || "v1"}
          actorRole={bundle.actor.role}
          actorGuestId={bundle.actor.guestId}
          locked={locked}
          selectedPinId={selectedPinId}
          onSelectPin={handleSelectPin}
          onCopyPinLink={handleCopyPinLink}
          onChangePinStatus={onChangePinStatus}
          onDeletePin={(pinId) => {
            const target = framePins.find((p) => p.id === pinId);
            if (target && target.submitted_at === null) {
              return onDeletePin(pinId);
            }
            setDeletePinConfirmId(pinId);
          }}
          onAddReply={onAddReply}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
          draftCount={draftCount}
          submittingDrafts={busyAction}
          onSubmitDrafts={handleSubmitDraftsClick}
          mobileSheetOpen={mobileSheetOpen}
          onToggleMobileSheet={() => setMobileSheetOpen((v) => !v)}
        />
      </div>

      {/* Overlays */}
      <BeforeAfterSlider
        open={showCompare}
        versions={sortedVersions}
        frames={bundle.frames}
        initialFrameTitle={activeFrame?.title}
        onClose={() => setShowCompare(false)}
      />

      <CopyWaSummaryModal
        open={showWaModal}
        projectTitle={bundle.project.title}
        versionLabel={activeVersion?.label ?? "v1"}
        pins={versionPins}
        frames={versionFrames}
        onClose={() => setShowWaModal(false)}
        onCopied={() => showToast({ message: "Ringkasan disalin ke clipboard.", tone: "success" })}
      />

      {activeVersion && onApproveVersion && (
        <ApprovalDialog
          open={showApproveModal}
          versionLabel={activeVersion.label}
          actorName={bundle.actor.name}
          unsentDraftCount={draftCount}
          busy={busyAction}
          onClose={() => setShowApproveModal(false)}
          onSendDraftsFirst={
            onSubmitDrafts
              ? async () => {
                  await handleSubmitDraftsClick();
                }
              : undefined
          }
          onConfirm={async (confirmName) => {
            setBusyAction(true);
            try {
              await onApproveVersion(activeVersion.id, confirmName);
              setShowApproveModal(false);
              showToast({ message: `${activeVersion.label} resmi di-ACC!`, tone: "success" });
            } finally {
              setBusyAction(false);
            }
          }}
        />
      )}

      {activeVersion && onRecordApproval && (
        <RecordApprovalDialog
          open={showRecordAccModal}
          defaultClientName={bundle.project.client_name}
          busy={busyAction}
          onClose={() => setShowRecordAccModal(false)}
          onConfirm={async (data) => {
            setBusyAction(true);
            try {
              await onRecordApproval(activeVersion.id, data);
              setShowRecordAccModal(false);
              showToast({ message: "Catatan ACC klien disimpan.", tone: "success" });
            } finally {
              setBusyAction(false);
            }
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletePinConfirmId)}
        title="Hapus pin ini?"
        description="Pin beserta seluruh komentar di dalamnya akan dihapus permanen dan dicatat di timeline."
        confirmLabel="Hapus pin"
        destructive
        busy={busyAction}
        onCancel={() => setDeletePinConfirmId(null)}
        onConfirm={async () => {
          if (!deletePinConfirmId) return;
          setBusyAction(true);
          try {
            await onDeletePin(deletePinConfirmId);
            setDeletePinConfirmId(null);
            showToast({ message: "Pin dihapus.", tone: "info" });
          } finally {
            setBusyAction(false);
          }
        }}
      />

      <ShortcutHelpModal
        open={showShortcuts}
        isOwner={isOwner}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}

export { buildAutoReleaseNotes };
