"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus, Search, Trash2 } from "lucide-react";
import { OwnerHeader } from "@/components/organisms/OwnerHeader";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { CreateProjectModal } from "@/components/molecules/CreateProjectModal";
import { DeleteProjectDialog } from "@/components/molecules/DeleteProjectDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { formatRelativeTime, getDeadlineState } from "@/lib/utils/dates";
import type { VersionStatus } from "@/lib/domain/types";

interface DashboardProject {
  id: string;
  title: string;
  client_name: string | null;
  review_due_at: string | null;
  archived_at: string | null;
  open_pin_count: number;
  new_feedback_count: number;
  last_activity_at: string;
  latest_version: {
    label: string;
    status: VersionStatus;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState("Akun");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DashboardProject | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, accRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/account"),
      ]);
      if (projRes.status === 401) {
        router.replace("/login?next=/dashboard");
        return;
      }
      if (!projRes.ok) {
        const d = await projRes.json().catch(() => ({}));
        throw new Error(d.error || "Gagal memuat proyek.");
      }
      const projData = await projRes.json();
      setProjects(projData.projects ?? []);

      if (accRes.ok) {
        const acc = await accRes.json();
        setAccountLabel(acc.studio_name || acc.email || "Akun");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function toggleArchive(proj: DashboardProject, archived: boolean) {
    const res = await fetch(`/api/projects/${proj.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) {
      showToast({ message: "Gagal mengubah status arsip.", tone: "error" });
      return;
    }
    await loadData();
    showToast({
      message: archived ? `"${proj.title}" diarsipkan.` : `"${proj.title}" dikembalikan ke Aktif.`,
      tone: "info",
      actionLabel: archived ? "Batalkan" : undefined,
      onAction: archived ? () => void toggleArchive(proj, false) : undefined,
    });
  }

  async function handlePermanentDelete(confirmTitle: string) {
    if (!deleteTarget) return;
    setBusyDelete(true);
    try {
      const res = await fetch(`/api/projects/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ message: data.error || "Gagal menghapus proyek.", tone: "error" });
        return;
      }
      setDeleteTarget(null);
      await loadData();
      showToast({ message: "Proyek dihapus permanen.", tone: "info" });
    } finally {
      setBusyDelete(false);
    }
  }

  const filtered = projects.filter((p) => {
    const inTab = tab === "archived" ? Boolean(p.archived_at) : !p.archived_at;
    if (!inTab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.client_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#F3F3EF] text-[#141414]">
      <OwnerHeader breadcrumb="Dashboard" accountLabel={accountLabel} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Proyek Review</h1>
            <p className="mt-1 text-sm text-[#52524E]">
              Kelola versi desain, feedback klien terbaru, dan status ACC.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded bg-[#141414] px-4 text-sm font-semibold text-[#F3F3EF] hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" /> Proyek baru
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("active")}
              className={`min-h-[36px] rounded px-3.5 text-xs font-semibold border ${
                tab === "active"
                  ? "border-[#141414] bg-[#141414] text-[#F3F3EF]"
                  : "border-[#C9C9C0] bg-white text-[#141414]"
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setTab("archived")}
              className={`min-h-[36px] rounded px-3.5 text-xs font-semibold border ${
                tab === "archived"
                  ? "border-[#141414] bg-[#141414] text-[#F3F3EF]"
                  : "border-[#C9C9C0] bg-white text-[#141414]"
              }`}
            >
              Arsip
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#787872]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul atau nama klien..."
              className="min-h-[38px] w-full rounded border border-[#C9C9C0] bg-white pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg border border-[#DFDFD8] bg-white"
              />
            ))
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-white p-6 text-center">
              <p className="text-sm text-[#F43F5E]">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-3 rounded bg-[#141414] px-4 py-2 text-xs font-semibold text-[#F3F3EF]"
              >
                Coba lagi
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-[#DFDFD8] bg-white p-8 text-center">
              {search.trim() ? (
                <>
                  <p className="text-sm text-[#52524E]">
                    Tidak ada proyek untuk &ldquo;{search}&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-3 rounded border border-[#C9C9C0] px-3.5 py-2 text-xs font-semibold"
                  >
                    Bersihkan pencarian
                  </button>
                </>
              ) : tab === "archived" ? (
                <p className="text-sm text-[#52524E]">Belum ada proyek yang diarsip.</p>
              ) : (
                <>
                  <p className="font-semibold">Mulai proyek pertamamu dalam 3 langkah</p>
                  <p className="mt-1 text-xs text-[#52524E]">
                    Upload desain → Bagikan link ke klien → Kunci persetujuan ACC.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="rounded bg-[#141414] px-4 py-2 text-xs font-semibold text-[#F3F3EF]"
                    >
                      Buat proyek pertama
                    </button>
                    <Link
                      href="/demo"
                      className="rounded border border-[#C9C9C0] px-4 py-2 text-xs font-semibold"
                    >
                      Lihat demo
                    </Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            filtered.map((p) => {
              const dueState = getDeadlineState(p.review_due_at);
              const badgeCount = p.new_feedback_count > 99 ? "99+" : p.new_feedback_count;
              const isApproved = p.latest_version?.status === "approved";

              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className={`flex cursor-pointer flex-col justify-between gap-3 rounded-lg border border-[#DFDFD8] bg-white p-4 transition hover:border-[#141414] sm:flex-row sm:items-center ${
                    isApproved ? "opacity-80" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate text-base font-bold">{p.title}</strong>
                      {p.new_feedback_count > 0 && !p.archived_at && (
                        <span className="rounded-full bg-[#F43F5E] px-2 py-0.5 text-[11px] font-bold text-white">
                          {badgeCount} baru
                        </span>
                      )}
                      {p.archived_at && (
                        <span className="rounded border border-[#DFDFD8] bg-[#F3F3EF] px-2 py-0.5 text-[11px] font-medium text-[#52524E]">
                          Diarsip (Read-only)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#52524E]">
                      {p.client_name && <span>{p.client_name}</span>}
                      <span className="font-mono-data">
                        {p.latest_version ? p.latest_version.label : "Belum ada versi"}
                      </span>
                      <span>{p.open_pin_count} pin open</span>
                      {dueState === "past" && (
                        <span className="font-semibold text-amber-700">Lewat tenggat</span>
                      )}
                      <span>Aktif {formatRelativeTime(p.last_activity_at)}</span>
                    </div>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p.latest_version && (
                      <StatusBadge status={p.latest_version.status} />
                    )}
                    <button
                      type="button"
                      onClick={() => void toggleArchive(p, !p.archived_at)}
                      aria-label={p.archived_at ? "Kembalikan proyek" : "Arsipkan proyek"}
                      className="inline-flex min-h-[38px] items-center gap-1 rounded border border-[#C9C9C0] px-2.5 text-xs font-semibold hover:bg-[#FAFAF8]"
                    >
                      {p.archived_at ? (
                        <>
                          <ArchiveRestore className="h-3.5 w-3.5" /> Kembalikan
                        </>
                      ) : (
                        <>
                          <Archive className="h-3.5 w-3.5" /> Arsipkan
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      aria-label="Hapus permanen"
                      className="inline-flex min-h-[38px] items-center rounded border border-rose-300 px-2.5 text-xs font-semibold text-[#F43F5E] hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(projectId) => {
          setCreateOpen(false);
          router.push(`/projects/${projectId}`);
        }}
      />

      <DeleteProjectDialog
        open={Boolean(deleteTarget)}
        projectTitle={deleteTarget?.title ?? ""}
        busy={busyDelete}
        onClose={() => setDeleteTarget(null)}
        onArchiveInstead={async () => {
          if (!deleteTarget) return;
          await toggleArchive(deleteTarget, true);
          setDeleteTarget(null);
        }}
        onConfirmDelete={handlePermanentDelete}
      />
    </div>
  );
}
