"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Lock, ShieldCheck, Sparkles, UserCheck, X } from "lucide-react";
import { ReviewWorkspace } from "@/components/templates/ReviewWorkspace";
import { useToast } from "@/components/providers/ToastProvider";
import { useReviewRealtime } from "@/lib/supabase/use-review-realtime";
import { formatDeadlineDate } from "@/lib/utils/dates";
import type { PendingPinInput } from "@/components/organisms/DesignCanvas";
import type {
  PinCommentRecord,
  PinRecord,
  PinStatus,
  ReviewBundle,
} from "@/lib/domain/types";

interface GateProjectInfo {
  id: string;
  title: string;
  has_passcode: boolean;
  review_due_at: string | null;
  archived_at: string | null;
  studio_name: string | null;
}

const GUEST_NAME_KEY = "signoff_last_guest_name";
const COACH_SEEN_KEY = "signoff_coach_seen";

function ClientReviewInner() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const initialFrameId = searchParams.get("frame");
  const initialPinId = searchParams.get("pin");

  const [loading, setLoading] = useState(true);
  const [invalidLink, setInvalidLink] = useState(false);
  const [gateProject, setGateProject] = useState<GateProjectInfo | null>(null);
  const [bundle, setBundle] = useState<ReviewBundle | null>(null);

  // Join form state
  const [guestName, setGuestName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number>(0);

  // Name switcher & first-visit coach mark
  const [switchNameOpen, setSwitchNameOpen] = useState(false);
  const [coachStep, setCoachStep] = useState<number | null>(null);
  const [latestBroadcastLabel, setLatestBroadcastLabel] = useState<string | null>(null);

  const loadReviewRoom = useCallback(async () => {
    setLoading(true);
    setInvalidLink(false);
    try {
      const res = await fetch(`/api/review/${token}`);
      if (res.status === 404) {
        setInvalidLink(true);
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Gagal memuat halaman review.");
      }
      const data = await res.json();
      if (data.joined) {
        setBundle(data as ReviewBundle);
        setGateProject(null);
      } else {
        setGateProject(data.project as GateProjectInfo);
        setBundle(null);
      }
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    try {
      const savedName = localStorage.getItem(GUEST_NAME_KEY);
      if (savedName) setGuestName(savedName);
    } catch {
      // Ignore storage access errors in private browsing
    }
    void loadReviewRoom();
  }, [loadReviewRoom]);

  const hasBundle = Boolean(bundle);

  // Show 3-step coach mark once per device after joining
  useEffect(() => {
    if (!hasBundle) return;
    try {
      const seen = localStorage.getItem(COACH_SEEN_KEY);
      if (!seen) {
        setCoachStep(1);
      }
    } catch {
      // Ignore storage errors
    }
  }, [hasBundle]);

  // Countdown timer on 429 rate-limit
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const t = setInterval(() => {
      setRateLimitSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [rateLimitSeconds]);

  // 50-minute signed URL refresh timer while active (preserves local draft UI)
  useEffect(() => {
    if (!hasBundle) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/review/${token}`);
      if (!res.ok) return;
      const fresh = await res.json();
      if (!fresh.joined) return;
      const freshBundle = fresh as ReviewBundle;
      setBundle((prev) => {
        if (!prev) return freshBundle;
        const freshFrameUrls = new Map(
          freshBundle.frames.map((f) => [f.id, f.signed_url])
        );
        return {
          ...freshBundle,
          frames: freshBundle.frames.map((f) => ({
            ...f,
            signed_url: freshFrameUrls.get(f.id) ?? f.signed_url,
          })),
        };
      });
    }, 50 * 60 * 1000);
    return () => clearInterval(timer);
  }, [hasBundle, token]);

  const { presenceMembers, connectionState } = useReviewRealtime({
    shareToken: bundle?.project.share_token ?? null,
    actor: bundle?.actor ?? null,
    setBundle,
    onNewVersion: (label) => setLatestBroadcastLabel(label),
  });

  function dismissCoachMark() {
    setCoachStep(null);
    try {
      localStorage.setItem(COACH_SEEN_KEY, "1");
    } catch {
      // Ignore storage errors
    }
  }

  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) {
      setJoinError("Nama Anda wajib diisi.");
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/review/${token}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: guestName.trim(),
          passcode: passcode.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setRateLimitSeconds(15 * 60);
        setJoinError(
          data.error || "Terlalu banyak percobaan passcode. Coba lagi dalam 15 menit."
        );
        return;
      }
      if (!res.ok) {
        setJoinError(data.error || "Gagal masuk ke ruang review.");
        return;
      }
      try {
        localStorage.setItem(GUEST_NAME_KEY, guestName.trim());
      } catch {
        // Ignore storage errors
      }
      setPasscode("");
      setSwitchNameOpen(false);
      await loadReviewRoom();
    } finally {
      setJoining(false);
    }
  }

  async function handleCreatePin(frameId: string, input: PendingPinInput): Promise<PinRecord> {
    try {
      const res = await fetch(`/api/review/${token}/pins`, {
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
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal menambahkan catatan.");
      }
      const created = data.pin as PinRecord;
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              pins: prev.pins.some((p) => p.id === created.id)
                ? prev.pins
                : [...prev.pins, created],
            }
          : prev
      );
      return created;
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal menyimpan pin.",
        tone: "error",
      });
      throw err;
    }
  }

  async function handleSubmitDrafts() {
    const res = await fetch(`/api/review/${token}/pins/submit`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast({
        message: data.error || "Gagal mengirim feedback.",
        tone: "error",
      });
      throw new Error(data.error || "Submit gagal.");
    }
    const nowIso = new Date().toISOString();
    setBundle((prev) =>
      prev
        ? {
            ...prev,
            pins: prev.pins.map((p) =>
              p.submitted_at === null ? { ...p, submitted_at: nowIso } : p
            ),
          }
        : prev
    );
    return data as { submittedCount: number; byVersion?: Record<string, number> };
  }

  async function handleChangePinStatus(pinId: string, status: PinStatus) {
    const res = await fetch(`/api/review/${token}/pins/${pinId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast({
        message: data.error || "Gagal memperbarui status pin.",
        tone: "error",
      });
      return;
    }
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
  }

  async function handleDeletePin(pinId: string) {
    const res = await fetch(`/api/review/${token}/pins/${pinId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast({
        message: data.error || "Gagal menghapus pin.",
        tone: "error",
      });
      return;
    }
    setBundle((prev) =>
      prev ? { ...prev, pins: prev.pins.filter((p) => p.id !== pinId) } : prev
    );
  }

  async function handleAddReply(pinId: string, body: string) {
    const res = await fetch(`/api/review/${token}/pins/${pinId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast({
        message: data.error || "Gagal mengirim balasan.",
        tone: "error",
      });
      return;
    }
    const created = data.comment as PinCommentRecord;
    setBundle((prev) =>
      prev
        ? {
            ...prev,
            pins: prev.pins.map((p) =>
              p.id === pinId
                ? {
                    ...p,
                    comments: p.comments.some((c) => c.id === created.id)
                      ? p.comments
                      : [...p.comments, created],
                  }
                : p
            ),
          }
        : prev
    );
  }

  async function handleEditComment(commentId: string, body: string) {
    const res = await fetch(`/api/review/${token}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast({
        message: data.error || "Gagal mengedit komentar.",
        tone: "error",
      });
      return;
    }
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
  }

  async function handleDeleteComment(commentId: string) {
    const res = await fetch(`/api/review/${token}/comments/${commentId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast({
        message: data.error || "Gagal menghapus komentar.",
        tone: "error",
      });
      return;
    }
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
  }

  async function handleApproveVersion(versionId: string, confirmName: string) {
    const res = await fetch(`/api/review/${token}/versions/${versionId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName, accepted: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast({
        message: data.error || "Gagal menyetujui versi.",
        tone: "error",
      });
      throw new Error(data.error || "Gagal ACC.");
    }
    setBundle((prev) =>
      prev
        ? {
            ...prev,
            versions: prev.versions.map((v) =>
              v.id === versionId ? { ...v, ...data.version } : v
            ),
          }
        : prev
    );
    showToast({ message: "Versi ini resmi disetujui (ACC)!", tone: "success" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F3EF] text-[#141414]">
        <img src="/brand/signoff-mark.svg" alt="SignOff" className="h-8 w-8 animate-pulse" />
        <p className="mt-3 text-sm text-[#52524E]">Menyiapkan ruang review...</p>
      </div>
    );
  }

  // S07b Invalid / Rotated Link Screen
  if (invalidLink) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F3EF] px-6 text-center text-[#141414]">
        <div className="w-full max-w-md rounded-lg border border-[#C9C9C0] bg-white p-7 shadow-sm">
          <img
            src="/brand/signoff-lockup-light.svg"
            alt="SignOff"
            className="mx-auto h-7"
          />
          <h1 className="mt-5 text-xl font-bold">Link ini sudah tidak aktif</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#52524E]">
            Link review mungkin sudah diperbarui oleh desainer atau proyek telah dihapus.
            Silakan minta link terbaru dari desainer Anda via WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/demo"
              className="rounded border border-[#C9C9C0] bg-white px-4 py-2 text-sm font-semibold text-[#141414] hover:bg-[#F3F3EF]"
            >
              Lihat Demo Interaktif
            </Link>
            <Link
              href="/"
              className="rounded bg-[#141414] px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // S07a Client Join Gate
  if (gateProject && !bundle) {
    const mins = Math.floor(rateLimitSeconds / 60);
    const secs = rateLimitSeconds % 60;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F3EF] px-4 py-8 text-[#141414]">
        <div className="w-full max-w-md rounded-xl border border-[#C9C9C0] bg-white p-6 shadow-md sm:p-7">
          <img src="/brand/signoff-lockup-light.svg" alt="SignOff" className="h-6" />

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[#52524E]">
            {gateProject.studio_name
              ? `${gateProject.studio_name} mengundang Anda untuk review:`
              : "Anda diundang untuk mereview desain:"}
          </p>
          <h1 className="mt-1 text-xl font-bold">{gateProject.title}</h1>

          {gateProject.review_due_at && (
            <p className="mt-2 inline-block rounded bg-[#FAFAF8] px-2.5 py-1 text-xs font-medium text-[#52524E] border border-[#DFDFD8]">
              Target review: {formatDeadlineDate(gateProject.review_due_at)}
            </p>
          )}

          {gateProject.archived_at && (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Proyek ini sedang diarsip (hanya baca). Anda tetap dapat melihat desain dan riwayat ACC.
            </div>
          )}

          <form onSubmit={handleJoinSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="guest-name" className="block text-xs font-semibold">
                Nama Anda (ditampilkan di pin & persetujuan ACC)
              </label>
              <input
                id="guest-name"
                required
                maxLength={40}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="cth. Budi — KopiKita"
                className="mt-1.5 min-h-[44px] w-full rounded border border-[#C9C9C0] px-3 text-sm focus:border-[#141414] focus:outline-none"
              />
            </div>

            {gateProject.has_passcode && (
              <div>
                <label htmlFor="guest-passcode" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Lock className="h-3.5 w-3.5 text-[#52524E]" />
                  Passcode 4 Digit dari Desainer
                </label>
                <input
                  id="guest-passcode"
                  required
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="font-mono-data mt-1.5 min-h-[44px] w-full rounded border border-[#C9C9C0] px-3 text-center text-lg tracking-[0.4em] focus:border-[#141414] focus:outline-none"
                />
              </div>
            )}

            {joinError && (
              <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-medium text-[#F43F5E]">
                <p>{joinError}</p>
                {rateLimitSeconds > 0 && (
                  <p className="font-mono-data mt-1 text-[11px] font-bold">
                    Coba lagi dalam {mins}:{String(secs).padStart(2, "0")}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={joining || rateLimitSeconds > 0}
              className="flex min-h-[44px] w-full items-center justify-center rounded bg-[#141414] px-4 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {joining ? "Membuka ruang review..." : "Buka Ruang Review"}
            </button>
          </form>

          <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[#52524E]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
            Tanpa daftar akun, langsung beri tanda dan catatan di desain.
          </p>
        </div>
      </div>
    );
  }

  if (!bundle) return null;

  const clientUtilityBar = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 sm:px-4">
      <div className="flex items-center gap-2">
        <UserCheck className="h-3.5 w-3.5 text-[#10B981]" />
        <span>
          Masuk sebagai <strong className="text-white">{bundle.actor.name}</strong>
        </span>
        <button
          type="button"
          onClick={() => setSwitchNameOpen(true)}
          className="text-[11px] text-slate-400 underline hover:text-white"
        >
          Bukan {bundle.actor.name}? Ganti nama
        </button>
      </div>
      {bundle.project.studio_name && (
        <span className="text-[11px] text-slate-400">
          Oleh {bundle.project.studio_name}
        </span>
      )}
    </div>
  );

  const coachCopy: Record<number, { title: string; body: string }> = {
    1: {
      title: "1/3 — Klik atau seret di desain",
      body: "Ketuk bagian mana saja untuk menaruh pin, atau seret kotak untuk menyorot area revisi.",
    },
    2: {
      title: "2/3 — Kirim Semua Feedback sekaligus",
      body: "Pin baru berstatus draft (hanya Anda yang melihat) sampai Anda menekan Kirim Semua Feedback.",
    },
    3: {
      title: "3/3 — Approve Versi Ini saat final",
      body: "Jika seluruh revisi sudah beres, tekan Approve Versi Ini untuk mengunci versi secara resmi.",
    },
  };

  return (
    <>
      <ReviewWorkspace
        bundle={bundle}
        mode="client"
        presenceMembers={presenceMembers}
        connectionState={connectionState}
        latestBroadcastVersionLabel={latestBroadcastLabel}
        onDismissNewVersionBanner={() => setLatestBroadcastLabel(null)}
        onCreatePin={handleCreatePin}
        onSubmitDrafts={handleSubmitDrafts}
        onChangePinStatus={handleChangePinStatus}
        onDeletePin={handleDeletePin}
        onAddReply={handleAddReply}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        onApproveVersion={handleApproveVersion}
        topSlot={clientUtilityBar}
        initialFrameId={initialFrameId}
        initialPinId={initialPinId}
      />

      {/* G09 First-Visit Coach Mark */}
      {coachStep !== null && coachCopy[coachStep] && (
        <div className="fixed bottom-4 left-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-slate-700 bg-[#111827] p-4 text-[#F8FAFC] shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#10B981]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{coachCopy[coachStep].title}</span>
            </div>
            <button
              type="button"
              onClick={dismissCoachMark}
              aria-label="Tutup panduan"
              className="rounded p-0.5 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
            {coachCopy[coachStep].body}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={dismissCoachMark}
              className="text-xs text-slate-400 hover:text-white"
            >
              Lewati
            </button>
            <button
              type="button"
              onClick={() => {
                if (coachStep >= 3) dismissCoachMark();
                else setCoachStep(coachStep + 1);
              }}
              className="rounded bg-[#F3F3EF] px-3 py-1 text-xs font-bold text-[#141414]"
            >
              {coachStep >= 3 ? "Mengerti" : "Lanjut"}
            </button>
          </div>
        </div>
      )}

      {/* Switch Guest Name Dialog */}
      {switchNameOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setSwitchNameOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-[#C9C9C0] bg-white p-5 text-[#141414] shadow-xl"
          >
            <h2 className="text-base font-bold">Ganti nama tamu</h2>
            <p className="mt-1 text-xs text-[#52524E]">
              Nama baru akan tercatat pada pin dan komentar Anda berikutnya.
            </p>
            <form onSubmit={handleJoinSubmit} className="mt-4 space-y-3">
              <input
                required
                maxLength={40}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nama lengkap Anda"
                className="min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
              />
              {bundle.project.has_passcode && (
                <input
                  required
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Passcode 4 digit"
                  className="font-mono-data min-h-[40px] w-full rounded border border-[#C9C9C0] px-3 text-sm"
                />
              )}
              {joinError && <p className="text-xs text-[#F43F5E]">{joinError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSwitchNameOpen(false)}
                  className="min-h-[38px] rounded border border-[#C9C9C0] px-3 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="min-h-[38px] rounded bg-[#141414] px-4 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {joining ? "Menyimpan..." : "Ganti Nama"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function ClientReviewRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F3F3EF] text-sm text-[#52524E]">
          Membuka ruang review...
        </div>
      }
    >
      <ClientReviewInner />
    </Suspense>
  );
}
