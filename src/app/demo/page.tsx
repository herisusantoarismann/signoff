"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RotateCcw, Sparkles } from "lucide-react";
import { ReviewWorkspace } from "@/components/templates/ReviewWorkspace";
import { useToast } from "@/components/providers/ToastProvider";
import {
  DEMO_CHANNEL_NAME,
  demoAddReply,
  demoApproveVersion,
  demoChangePinStatus,
  demoCreatePin,
  demoDeleteComment,
  demoDeletePin,
  demoEditComment,
  demoSubmitDrafts,
  loadDemoBundle,
  resetDemoBundle,
} from "@/lib/demo/demo-store";
import type { PendingPinInput } from "@/components/organisms/DesignCanvas";
import type { PresenceMember } from "@/components/atoms/PresenceAvatars";
import type { PinRecord, PinStatus, ReviewActor, ReviewBundle } from "@/lib/domain/types";

function DemoWorkspaceInner() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const initialFrameId = searchParams.get("frame");
  const initialPinId = searchParams.get("pin");

  const [role, setRole] = useState<"client" | "owner">("client");
  const [bundle, setBundle] = useState<ReviewBundle | null>(null);

  useEffect(() => {
    setBundle(loadDemoBundle(role));
  }, [role]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(DEMO_CHANNEL_NAME);
    } catch {
      return;
    }

    channel.onmessage = (event) => {
      if (event.data?.type === "demo_sync" && event.data?.payload) {
        const actor: ReviewActor =
          role === "owner"
            ? { role: "owner", name: "Raka — Studio Senja", ownerId: "demo-owner-studio-senja" }
            : { role: "client", name: "Budi — KopiKita", guestId: "demo-guest-budi" };
        setBundle({
          ...(event.data.payload as Omit<ReviewBundle, "actor">),
          actor,
        });
      }
    };

    return () => {
      channel.close();
    };
  }, [role]);

  if (!bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-sm text-slate-300">
        Memuat demo interaktif SignOff...
      </div>
    );
  }

  const presenceMembers: PresenceMember[] = [
    { key: "demo-client", actorName: "Budi — KopiKita", role: "client" },
    { key: "demo-owner", actorName: "Raka — Studio Senja", role: "owner" },
  ];

  async function handleCreatePin(frameId: string, input: PendingPinInput): Promise<PinRecord> {
    if (!bundle) throw new Error("Demo belum siap.");
    try {
      const res = demoCreatePin(bundle, frameId, input);
      setBundle(res.bundle);
      return res.created;
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Gagal menaruh pin.",
        tone: "error",
      });
      throw err;
    }
  }

  async function handleSubmitDrafts() {
    if (!bundle) return { submittedCount: 0 };
    const res = demoSubmitDrafts(bundle);
    setBundle(res.bundle);
    return { submittedCount: res.submittedCount };
  }

  async function handleChangePinStatus(pinId: string, status: PinStatus) {
    if (!bundle) return;
    setBundle(demoChangePinStatus(bundle, pinId, status));
  }

  async function handleDeletePin(pinId: string) {
    if (!bundle) return;
    setBundle(demoDeletePin(bundle, pinId));
  }

  async function handleAddReply(pinId: string, body: string) {
    if (!bundle) return;
    setBundle(demoAddReply(bundle, pinId, body));
  }

  async function handleEditComment(commentId: string, body: string) {
    if (!bundle) return;
    setBundle(demoEditComment(bundle, commentId, body));
  }

  async function handleDeleteComment(commentId: string) {
    if (!bundle) return;
    setBundle(demoDeleteComment(bundle, commentId));
  }

  async function handleApproveVersion(versionId: string, confirmName: string) {
    if (!bundle) return;
    const updated = demoApproveVersion(bundle, versionId, confirmName);
    setBundle(updated);
    showToast({ message: "Versi demo resmi di-ACC dan dikunci!", tone: "success" });
  }

  function handleResetDemo() {
    const fresh = resetDemoBundle(role);
    setBundle(fresh);
    showToast({ message: "Demo direset ke kondisi awal.", tone: "info" });
  }

  const demoBanner = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 sm:px-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 font-mono-data text-[11px] font-bold text-[#10B981]">
          <Sparkles className="h-3 w-3" />
          DEMO INTERAKTIF
        </span>
        <span className="hidden text-slate-400 md:inline">
          Coba buka di 2 tab browser untuk melihat sinkronisasi lokal langsung.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Pilih peran demo"
          className="inline-flex rounded border border-slate-700 bg-slate-900 p-0.5"
        >
          <button
            type="button"
            onClick={() => setRole("client")}
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
              role === "client"
                ? "bg-[#F3F3EF] text-[#141414]"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Sebagai Klien
          </button>
          <button
            type="button"
            onClick={() => setRole("owner")}
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
              role === "owner"
                ? "bg-[#F3F3EF] text-[#141414]"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Sebagai Desainer
          </button>
        </div>

        <button
          type="button"
          onClick={handleResetDemo}
          className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-slate-500"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset demo</span>
        </button>

        <Link
          href="/login?mode=signup"
          className="inline-flex items-center rounded bg-[#F3F3EF] px-2.5 py-1 text-[11px] font-bold text-[#141414] hover:bg-white"
        >
          Daftar untuk proyek asli
        </Link>
      </div>
    </div>
  );

  return (
    <ReviewWorkspace
      bundle={bundle}
      mode="demo"
      presenceMembers={presenceMembers}
      connectionState="connected"
      onCreatePin={handleCreatePin}
      onSubmitDrafts={role === "client" ? handleSubmitDrafts : undefined}
      onChangePinStatus={handleChangePinStatus}
      onDeletePin={handleDeletePin}
      onAddReply={handleAddReply}
      onEditComment={handleEditComment}
      onDeleteComment={handleDeleteComment}
      onApproveVersion={role === "client" ? handleApproveVersion : undefined}
      topSlot={demoBanner}
      initialFrameId={initialFrameId}
      initialPinId={initialPinId}
    />
  );
}

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-sm text-slate-300">
          Memuat demo interaktif...
        </div>
      }
    >
      <DemoWorkspaceInner />
    </Suspense>
  );
}
