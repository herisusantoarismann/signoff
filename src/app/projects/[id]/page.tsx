"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Activity, Archive, ArchiveRestore, Settings, Trash2, X } from "lucide-react";
import { ReviewWorkspace } from "@/components/templates/ReviewWorkspace";
import { SharePanel } from "@/components/molecules/SharePanel";
import { VersionUploadModal } from "@/components/molecules/VersionUploadModal";
import { DeleteProjectDialog } from "@/components/molecules/DeleteProjectDialog";
import { SessionExpiredModal } from "@/components/molecules/SessionExpiredModal";
import { useToast } from "@/components/providers/ToastProvider";
import { useReviewRealtime } from "@/lib/supabase/use-review-realtime";
import { buildAutoReleaseNotes } from "@/lib/utils/release-notes";
import { formatIndonesianDateTime, formatRelativeTime } from "@/lib/utils/dates";
import type { PendingPinInput } from "@/components/organisms/DesignCanvas";
import type {
  ApprovalSource,
  PinCommentRecord,
  PinRecord,
  PinStatus,
  ReviewBundle,
} from "@/lib/domain/types";

function OwnerWorkspaceInner() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const initialFrameId = searchParams.get("frame");
  const initialPinId = searchParams.get("pin");

  const [bundle, setBundle] = useState<ReviewBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busySettings, setBusySettings] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [latestBroadcastLabel, setLatestBroadcastLabel] = useState<string | null>(null);

  // Project settings form fields
  const [editTitle, setEditTitle] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editDueAt, setEditDueAt] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setNotFoundError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/projects/${projectId}`)}`);
        return;
      }
      if (res.status === 404) {
        setNotFoundError("Proyek tidak ditemukan atau bukan milik akun ini.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Gagal memuat workspace proyek.");
      }
      const data = (await res.json()) as ReviewBundle;
      setBundle(data);
      setEditTitle(data.project.title);
      setEditClientName(data.project.client_name ?? "");
      setEditDueAt(data.project.review_due_at ? data.project.review_due_at.slice(0, 10) : "");

      void fetch(`/api/projects/${projectId}/seen`, { method: "POST" });
    } catch (err) {
      setNotFoundError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const hasBundle = Boolean(bundle);

  // Refresh signed URLs every 50 minutes (1h expiry)
  useEffect(() => {
    if (!hasBundle) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        const fresh = (await res.json()) as ReviewBundle;
        setBundle(fresh);
      }
    }, 50 * 60 * 1000);
    return () => clearInterval(timer);
  }, [hasBundle, projectId]);

  const { presenceMembers, connectionState } = useReviewRealtime({
    shareToken: bundle?.project.share_token ?? null,
    actor: bundle?.actor ?? null,
    setBundle,
    onNewVersion: (label) => setLatestBroadcastLabel(label),
  });

  const sortedVersions = useMemo(
    () =>
      [...(bundle?.versions ?? [])].sort((a, b) => a.version_number - b.version_number),
    [bundle?.versions]
  );
  const latestVersion = sortedVersions[sortedVersions.length - 1] ?? null;

  const autoReleaseNotes = useMemo(() => {
    if (!bundle || !latestVersion) return "";
    const latestFrameIds = new Set(
      bundle.frames.filter((f) => f.version_id === latestVersion.id).map((f) => f.id)
    );
    const openPins = bundle.pins.filter(
      (p) => latestFrameIds.has(p.frame_id) && p.submitted_at !== null && p.status === "open"
    );
    return buildAutoReleaseNotes(openPins);
  }, [bundle, latestVersion]);

  async function apiMutate<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (res.status === 401) {
      setSessionExpired(true);
      throw new Error("Sesi login Anda telah berakhir.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Permintaan gagal diproses.");
    }
    return data as T;
  }

  async function handleCreatePin(frameId: string, input: PendingPinInput): Promise<PinRecord> {
    if (!bundle) throw new Error("Workspace belum siap.");
    try {
      const data = await apiMutate<{ pin: PinRecord }>(
        `/api/review/${bundle.project.share_token}/pins`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frameId,
            kind: input.kind,
            xNorm: input.xNorm,
            yNorm: input.yNorm,
            wNorm: input.wNorm,
            hNorm: input.hNorm,
            category: input.category,
            body: input.body,
          }),
        }
      );
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              pins: prev.pins.some((p) => p.id === data.pin.id)
                ? prev.pins
                : [...prev.pins, data.pin],
            }
          : prev
      );
      return data.pin;
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal membuat pin.",
        tone: "error",
      });
      throw err;
    }
  }

  async function handleChangePinStatus(pinId: string, status: PinStatus) {
    if (!bundle) return;
    try {
      const data = await apiMutate<{ pin: PinRecord }>(
        `/api/review/${bundle.project.share_token}/pins/${pinId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              pins: prev.pins.map((p) =>
                p.id === pinId ? { ...p, status: data.pin.status } : p
              ),
            }
          : prev
      );
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal mengubah status pin.",
        tone: "error",
      });
    }
  }

  async function handleDeletePin(pinId: string) {
    if (!bundle) return;
    try {
      await apiMutate(`/api/review/${bundle.project.share_token}/pins/${pinId}`, {
        method: "DELETE",
      });
      setBundle((prev) =>
        prev ? { ...prev, pins: prev.pins.filter((p) => p.id !== pinId) } : prev
      );
      showToast({ message: "Pin dihapus.", tone: "success" });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal menghapus pin.",
        tone: "error",
      });
    }
  }

  async function handleAddReply(pinId: string, body: string) {
    if (!bundle) return;
    try {
      const data = await apiMutate<{ comment: PinCommentRecord }>(
        `/api/review/${bundle.project.share_token}/pins/${pinId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        }
      );
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              pins: prev.pins.map((p) =>
                p.id === pinId
                  ? {
                      ...p,
                      comments: p.comments.some((c) => c.id === data.comment.id)
                        ? p.comments
                        : [...p.comments, data.comment],
                    }
                  : p
              ),
            }
          : prev
      );
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal mengirim balasan.",
        tone: "error",
      });
    }
  }

  async function handleEditComment(commentId: string, body: string) {
    if (!bundle) return;
    try {
      const data = await apiMutate<{ comment: PinCommentRecord }>(
        `/api/review/${bundle.project.share_token}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        }
      );
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              pins: prev.pins.map((p) => ({
                ...p,
                comments: p.comments.map((c) =>
                  c.id === commentId ? { ...c, ...data.comment } : c
                ),
              })),
            }
          : prev
      );
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal mengedit komentar.",
        tone: "error",
      });
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!bundle) return;
    try {
      await apiMutate(`/api/review/${bundle.project.share_token}/comments/${commentId}`, {
        method: "DELETE",
      });
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              pins: prev.pins.map((p) => ({
                ...p,
                comments: p.comments.filter((c) => c.id !== commentId),
              })),
            }
          : prev
      );
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal menghapus komentar.",
        tone: "error",
      });
    }
  }

  async function handleRecordApproval(
    versionId: string,
    data: { clientName: string; source: ApprovalSource; note: string }
  ) {
    try {
      const res = await apiMutate<{ version: ReviewBundle["versions"][number] }>(
        `/api/projects/${projectId}/versions/${versionId}/record-approval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              versions: prev.versions.map((v) =>
                v.id === versionId ? { ...v, ...res.version } : v
              ),
            }
          : prev
      );
      showToast({ message: "ACC berhasil dicatat.", tone: "success" });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal mencatat ACC.",
        tone: "error",
      });
    }
  }

  async function handleUploadVersion(formData: FormData) {
    try {
      await apiMutate(`/api/projects/${projectId}/versions`, {
        method: "POST",
        body: formData,
      });
      showToast({ message: "Versi baru berhasil diunggah!", tone: "success" });
      await loadWorkspace();
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal mengunggah versi baru.",
        tone: "error",
      });
      throw err;
    }
  }

  async function handleUpdatePasscode(newPasscode: string | null) {
    try {
      const res = await apiMutate<{ has_passcode?: boolean }>(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: newPasscode }),
      });
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                has_passcode:
                  typeof res.has_passcode === "boolean"
                    ? res.has_passcode
                    : Boolean(newPasscode),
              },
            }
          : prev
      );
      showToast({
        message: newPasscode ? "Passcode diperbarui." : "Passcode dihapus.",
        tone: "success",
      });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal memperbarui passcode.",
        tone: "error",
      });
    }
  }

  async function handleRotateToken() {
    try {
      const res = await apiMutate<{ share_token: string }>(
        `/api/projects/${projectId}/rotate-token`,
        { method: "POST" }
      );
      setBundle((prev) =>
        prev
          ? { ...prev, project: { ...prev.project, share_token: res.share_token } }
          : prev
      );
      showToast({
        message: "Link baru dibuat. Link lama sudah dinonaktifkan.",
        tone: "success",
      });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal mengganti link.",
        tone: "error",
      });
    }
  }

  async function handleSwitchVersionStatus(
    versionId: string,
    nextStatus: "in_review" | "changes_requested"
  ) {
    try {
      const res = await apiMutate<{ version: ReviewBundle["versions"][number] }>(
        `/api/projects/${projectId}/versions/${versionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              versions: prev.versions.map((v) =>
                v.id === versionId ? { ...v, ...res.version } : v
              ),
            }
          : prev
      );
      showToast({
        message:
          nextStatus === "changes_requested"
            ? "Status ditandai Perlu Revisi."
            : "Status dibuka kembali untuk review.",
        tone: "success",
      });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal mengubah status versi.",
        tone: "error",
      });
    }
  }

  async function handleRenameFrame(versionId: string, frameId: string, title: string) {
    try {
      await apiMutate(`/api/projects/${projectId}/versions/${versionId}/frames`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: [{ id: frameId, title }] }),
      });
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              frames: prev.frames.map((f) => (f.id === frameId ? { ...f, title } : f)),
            }
          : prev
      );
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal mengubah nama frame.",
        tone: "error",
      });
    }
  }

  async function handleSaveProjectSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setBusySettings(true);
    try {
      await apiMutate(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          client_name: editClientName.trim() || null,
          review_due_at: editDueAt ? new Date(`${editDueAt}T23:59:59`).toISOString() : null,
        }),
      });
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                title: editTitle.trim(),
                client_name: editClientName.trim() || null,
                review_due_at: editDueAt
                  ? new Date(`${editDueAt}T23:59:59`).toISOString()
                  : null,
              },
            }
          : prev
      );
      setSettingsOpen(false);
      showToast({ message: "Pengaturan proyek disimpan.", tone: "success" });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal menyimpan pengaturan.",
        tone: "error",
      });
    } finally {
      setBusySettings(false);
    }
  }

  async function handleToggleArchive(archived: boolean) {
    setBusySettings(true);
    try {
      await apiMutate(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                archived_at: archived ? new Date().toISOString() : null,
              },
            }
          : prev
      );
      setSettingsOpen(false);
      setDeleteOpen(false);
      showToast({
        message: archived ? "Proyek diarsipkan." : "Proyek dikembalikan ke aktif.",
        tone: "success",
      });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal mengubah arsip.",
        tone: "error",
      });
    } finally {
      setBusySettings(false);
    }
  }

  async function handleConfirmDelete(confirmTitle: string) {
    setBusyDelete(true);
    try {
      await apiMutate(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmTitle }),
      });
      showToast({ message: "Proyek dihapus permanen.", tone: "success" });
      router.replace("/dashboard");
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal menghapus proyek.",
        tone: "error",
      });
    } finally {
      setBusyDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] text-slate-300">
        <img src="/brand/signoff-mark-inverse.svg" alt="SignOff" className="h-8 w-8 animate-pulse" />
        <p className="mt-3 text-sm">Memuat workspace proyek...</p>
      </div>
    );
  }

  if (notFoundError || !bundle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F3EF] px-6 text-center text-[#141414]">
        <div className="max-w-md rounded-lg border border-[#C9C9C0] bg-white p-7 shadow-sm">
          <h1 className="text-xl font-bold">Proyek tidak dapat dibuka</h1>
          <p className="mt-2 text-sm text-[#52524E]">
            {notFoundError || "Data proyek tidak tersedia."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link
              href="/dashboard"
              className="rounded bg-[#141414] px-4 py-2 text-sm font-semibold text-white"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isArchived = Boolean(bundle.project.archived_at);

  const ownerUtilityBar = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 sm:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Klien:{" "}
          <strong className="text-white">
            {bundle.project.client_name || "Belum diisi"}
          </strong>
        </span>
        {latestVersion && latestVersion.status !== "approved" && !isArchived && (
          <button
            type="button"
            onClick={() =>
              handleSwitchVersionStatus(
                latestVersion.id,
                latestVersion.status === "in_review" ? "changes_requested" : "in_review"
              )
            }
            className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-slate-500"
          >
            {latestVersion.status === "in_review"
              ? "Tandai Perlu Revisi"
              : "Buka Lagi untuk Review"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActivityOpen(true)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Aktivitas ({bundle.activities.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Pengaturan</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <ReviewWorkspace
        bundle={bundle}
        mode="owner"
        presenceMembers={presenceMembers}
        connectionState={connectionState}
        latestBroadcastVersionLabel={latestBroadcastLabel}
        onDismissNewVersionBanner={() => setLatestBroadcastLabel(null)}
        onCreatePin={handleCreatePin}
        onChangePinStatus={handleChangePinStatus}
        onDeletePin={handleDeletePin}
        onAddReply={handleAddReply}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        onRecordApproval={handleRecordApproval}
        onOpenUploadModal={() => setUploadOpen(true)}
        onOpenShareModal={() => setShareOpen(true)}
        onSwitchVersionStatus={handleSwitchVersionStatus}
        onRenameFrame={handleRenameFrame}
        topSlot={ownerUtilityBar}
        initialFrameId={initialFrameId}
        initialPinId={initialPinId}
      />

      <VersionUploadModal
        open={uploadOpen}
        nextVersionNumber={(latestVersion?.version_number ?? 0) + 1}
        initialNotes={autoReleaseNotes}
        onSubmitUpload={handleUploadVersion}
        onClose={() => setUploadOpen(false)}
      />

      <SharePanel
        open={shareOpen}
        projectTitle={bundle.project.title}
        versionLabel={latestVersion?.label ?? "v1"}
        shareToken={bundle.project.share_token}
        hasPasscode={bundle.project.has_passcode}
        onUpdatePasscode={handleUpdatePasscode}
        onRotateToken={handleRotateToken}
        onClose={() => setShareOpen(false)}
      />

      {/* O07 Project Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-5 text-[#141414] shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Pengaturan Proyek</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded p-1 text-[#52524E] hover:bg-[#F3F3EF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProjectSettings} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold">Judul Proyek</label>
                <input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold">Nama Klien</label>
                <input
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  placeholder="cth. PT Kopi Nusantara"
                  className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold">Batas Waktu Review</label>
                <input
                  type="date"
                  value={editDueAt}
                  onChange={(e) => setEditDueAt(e.target.value)}
                  className="mt-1 min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="min-h-[40px] rounded border border-[#C9C9C0] px-4 text-sm font-semibold"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={busySettings || !editTitle.trim()}
                  className="min-h-[40px] rounded bg-[#141414] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busySettings ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>

            <div className="mt-5 space-y-2 border-t border-[#DFDFD8] pt-4">
              <button
                type="button"
                disabled={busySettings}
                onClick={() => handleToggleArchive(!isArchived)}
                className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded border border-[#C9C9C0] bg-[#FAFAF8] px-3 text-xs font-semibold hover:bg-[#F3F3EF]"
              >
                {isArchived ? (
                  <>
                    <ArchiveRestore className="h-4 w-4" />
                    Kembalikan dari Arsip
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    Arsipkan Proyek (Read-Only)
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setDeleteOpen(true);
                }}
                className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-[#F43F5E] hover:bg-rose-100"
              >
                <Trash2 className="h-4 w-4" />
                Hapus Proyek Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* O10 Activity Timeline Drawer */}
      {activityOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60"
          onClick={() => setActivityOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col bg-white p-5 text-[#141414] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#DFDFD8] pb-3">
              <h2 className="text-base font-bold">Riwayat Aktivitas Proyek</h2>
              <button
                type="button"
                onClick={() => setActivityOpen(false)}
                className="rounded p-1 text-[#52524E] hover:bg-[#F3F3EF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {bundle.activities.length === 0 ? (
                <p className="text-sm text-[#52524E]">Belum ada aktivitas tercatat.</p>
              ) : (
                bundle.activities.map((act) => (
                  <div
                    key={act.id}
                    className="rounded border border-[#DFDFD8] bg-[#FAFAF8] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="font-semibold">{act.actor_name}</strong>
                      <span
                        title={formatIndonesianDateTime(act.created_at)}
                        className="text-[11px] text-[#52524E]"
                      >
                        {formatRelativeTime(act.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 font-mono-data text-[11px] text-[#52524E]">
                      {act.action_type}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      <DeleteProjectDialog
        open={deleteOpen}
        projectTitle={bundle.project.title}
        busy={busyDelete}
        onArchiveInstead={() => handleToggleArchive(true)}
        onConfirmDelete={handleConfirmDelete}
        onClose={() => setDeleteOpen(false)}
      />

      <SessionExpiredModal
        open={sessionExpired}
        nextPath={`/projects/${projectId}`}
      />
    </>
  );
}

export default function OwnerProjectWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-sm text-slate-300">
          Memuat workspace...
        </div>
      }
    >
      <OwnerWorkspaceInner />
    </Suspense>
  );
}
