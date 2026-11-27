"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Link2, RotateCcw, Send, Trash2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/dates";
import {
  PIN_CATEGORY_LABELS,
  PIN_STATUS_LABELS,
  type ActorRole,
  type PinCategory,
  type PinRecord,
  type PinStatus,
  type ProjectActivityRecord,
} from "@/lib/domain/types";

interface ThreadSidebarProps {
  pins: PinRecord[];
  activities: ProjectActivityRecord[];
  versionNotes: string;
  versionLabel: string;
  actorRole: ActorRole;
  actorGuestId?: string;
  locked: boolean;
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  onCopyPinLink: (pin: PinRecord) => void;
  onChangePinStatus: (pinId: string, status: PinStatus) => Promise<void> | void;
  onDeletePin: (pinId: string) => Promise<void> | void;
  onAddReply: (pinId: string, body: string) => Promise<void> | void;
  onEditComment: (commentId: string, body: string) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
  draftCount: number;
  submittingDrafts: boolean;
  onSubmitDrafts: () => Promise<void> | void;
  mobileSheetOpen: boolean;
  onToggleMobileSheet: () => void;
}

const STATUS_BADGE: Record<PinStatus, string> = {
  open: "bg-[#F43F5E]/15 text-rose-700",
  in_progress: "bg-[#3B82F6]/15 text-blue-700",
  resolved: "bg-[#10B981]/15 text-emerald-700",
};

const STATUS_DOT: Record<PinStatus, string> = {
  open: "bg-[#F43F5E]",
  in_progress: "bg-[#3B82F6]",
  resolved: "bg-[#10B981]",
};

export function ThreadSidebar({
  pins,
  activities,
  versionNotes,
  versionLabel,
  actorRole,
  actorGuestId,
  locked,
  selectedPinId,
  onSelectPin,
  onCopyPinLink,
  onChangePinStatus,
  onDeletePin,
  onAddReply,
  onEditComment,
  onDeleteComment,
  draftCount,
  submittingDrafts,
  onSubmitDrafts,
  mobileSheetOpen,
  onToggleMobileSheet,
}: ThreadSidebarProps) {
  const [tab, setTab] = useState<"pins" | "activity">("pins");
  const [statusFilter, setStatusFilter] = useState<"all" | PinStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | PinCategory>("all");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [activityLimit, setActivityLimit] = useState(15);

  const filteredPins = pins.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    return true;
  });

  function canEditOrDeleteComment(c: PinRecord["comments"][number]): boolean {
    if (locked || c.deleted_at) return false;
    if (actorRole === "owner") return c.author_role === "owner";
    return Boolean(actorGuestId && c.author_session_id === actorGuestId);
  }

  async function handleReplySubmit(e: React.FormEvent, pinId: string) {
    e.preventDefault();
    const text = (replyDrafts[pinId] ?? "").trim();
    if (!text) return;
    await onAddReply(pinId, text);
    setReplyDrafts((prev) => ({ ...prev, [pinId]: "" }));
  }

  return (
    <aside
      aria-label="Daftar feedback dan komentar"
      className={`flex flex-col border-[#DFDFD8] bg-white text-[#141414] md:static md:h-auto md:w-[290px] lg:w-[340px] xl:w-[360px] md:rounded-none md:border-l md:border-t-0 md:shadow-none ${
        mobileSheetOpen
          ? "fixed bottom-0 left-0 right-0 z-30 max-h-[70dvh] rounded-t-2xl border-t shadow-2xl pb-[env(safe-area-inset-bottom)] md:max-h-none md:pb-0"
          : "fixed bottom-0 left-0 right-0 z-30 h-auto rounded-t-2xl border-t shadow-2xl pb-[env(safe-area-inset-bottom)] md:pb-0"
      }`}
    >
      {/* Mobile Bottom Sheet Handle */}
      <div className="flex min-h-[48px] w-full items-center justify-between gap-2 border-b border-[#DFDFD8] px-3.5 md:hidden">
        <button
          type="button"
          onClick={onToggleMobileSheet}
          className="flex min-h-[44px] flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="text-sm font-bold">Feedback ({filteredPins.length})</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#52524E]">
            {mobileSheetOpen ? (
              <>
                Tutup <ChevronDown className="h-4 w-4" />
              </>
            ) : (
              <>
                Buka <ChevronUp className="h-4 w-4" />
              </>
            )}
          </span>
        </button>
        {!mobileSheetOpen && actorRole === "client" && draftCount > 0 && !locked && (
          <button
            type="button"
            disabled={submittingDrafts}
            onClick={onSubmitDrafts}
            className="min-h-[34px] shrink-0 rounded bg-[#141414] px-2.5 text-[11px] font-bold text-[#F3F3EF] disabled:opacity-50"
          >
            {submittingDrafts ? "Mengirim..." : `Kirim (${draftCount})`}
          </button>
        )}
      </div>

      {/* Tabs (Feedback / Aktivitas) */}
      <div className={`${mobileSheetOpen ? "flex" : "hidden md:flex"} border-b border-[#DFDFD8]`}>
        <button
          type="button"
          onClick={() => setTab("pins")}
          className={`flex-1 py-2.5 text-xs font-semibold ${
            tab === "pins"
              ? "border-b-2 border-[#141414] text-[#141414]"
              : "text-[#52524E] hover:text-[#141414]"
          }`}
        >
          Feedback ({filteredPins.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("activity")}
          className={`flex-1 py-2.5 text-xs font-semibold ${
            tab === "activity"
              ? "border-b-2 border-[#141414] text-[#141414]"
              : "text-[#52524E] hover:text-[#141414]"
          }`}
        >
          Aktivitas
        </button>
      </div>

      {/* Body */}
      <div className={`min-h-0 flex-1 flex-col ${mobileSheetOpen ? "flex" : "hidden md:flex"}`}>
        {tab === "activity" ? (
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {versionNotes && (
              <div className="rounded-md border border-[#DFDFD8] bg-[#FAFAF8] p-3 text-xs">
                <p className="font-semibold text-[#141414]">Catatan {versionLabel}</p>
                <p className="mt-1 whitespace-pre-line text-[#52524E]">{versionNotes}</p>
              </div>
            )}
            {activities.slice(0, activityLimit).map((act) => (
              <div key={act.id} className="rounded border border-[#DFDFD8] p-2.5 text-xs">
                <p className="text-[#141414]">
                  <strong>{act.actor_name}</strong> · {act.action_type.replaceAll("_", " ")}
                </p>
                <p className="font-mono-data mt-1 text-[11px] text-[#787872]">
                  {formatRelativeTime(act.created_at)}
                </p>
              </div>
            ))}
            {activities.length > activityLimit && (
              <button
                type="button"
                onClick={() => setActivityLimit((n) => n + 15)}
                className="w-full rounded border border-[#DFDFD8] py-1.5 text-xs font-semibold text-[#52524E]"
              >
                Muat lebih banyak
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-2 border-b border-[#DFDFD8] p-2.5">
              <select
                aria-label="Filter status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | PinStatus)}
                className="flex-1 rounded border border-[#C9C9C0] bg-white px-2 py-1.5 text-xs"
              >
                <option value="all">Semua Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                aria-label="Filter kategori"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as "all" | PinCategory)}
                className="flex-1 rounded border border-[#C9C9C0] bg-white px-2 py-1.5 text-xs"
              >
                <option value="all">Semua Kategori</option>
                {(Object.keys(PIN_CATEGORY_LABELS) as PinCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {PIN_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
              {filteredPins.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#52524E]">
                  <p>Belum ada pin di filter ini. Klik gambar di kiri untuk menaruh pin.</p>
                  {(statusFilter !== "all" || categoryFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("all");
                        setCategoryFilter("all");
                      }}
                      className="mt-3 rounded border border-[#C9C9C0] px-3 py-1.5 font-semibold text-[#141414]"
                    >
                      Reset filter
                    </button>
                  )}
                </div>
              ) : (
                filteredPins.map((pin) => {
                  const isSel = selectedPinId === pin.id;
                  const isDraft = pin.submitted_at === null;
                  const isOwnClientPin =
                    actorRole === "client" &&
                    Boolean(actorGuestId && pin.author_session_id === actorGuestId);

                  return (
                    <div
                      key={pin.id}
                      onClick={() => onSelectPin(pin.id)}
                      className={`cursor-pointer rounded-md border p-3 transition ${
                        isSel
                          ? "border-[#141414] bg-white shadow-sm"
                          : "border-[#DFDFD8] bg-[#FAFAF8] hover:border-[#C9C9C0]"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono-data text-xs font-bold">
                            #{pin.pin_number}
                          </span>
                          {isDraft ? (
                            <span className="rounded border border-dashed border-[#787872] bg-[#F3F3EF] px-2 py-0.5 text-[11px] font-semibold">
                              Draft
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[pin.status]}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[pin.status]}`} />
                              {PIN_STATUS_LABELS[pin.status]}
                            </span>
                          )}
                          <span className="rounded border border-[#DFDFD8] bg-[#F3F3EF] px-1.5 py-0.5 text-[11px] text-[#52524E]">
                            {PIN_CATEGORY_LABELS[pin.category]}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyPinLink(pin);
                          }}
                          title="Copy link ke pin ini"
                          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[#52524E] hover:bg-[#F3F3EF] hover:text-[#141414]"
                        >
                          <Link2 className="h-3 w-3" />
                          Link
                        </button>
                      </div>

                      <div className="space-y-2">
                        {pin.comments.map((c) => (
                          <div key={c.id} className="text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span>
                                <strong className="font-semibold">{c.author_name}</strong>
                                <span className="font-mono-data ml-1.5 text-[10px] text-[#787872]">
                                  {formatRelativeTime(c.created_at)}
                                </span>
                                {c.edited_at && !c.deleted_at && (
                                  <span className="ml-1 text-[10px] text-[#787872]">(diedit)</span>
                                )}
                              </span>
                              {canEditOrDeleteComment(c) && (
                                <span
                                  className="flex gap-1.5 text-[10px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(c.id);
                                      setEditingBody(c.body);
                                    }}
                                    className="text-[#52524E] hover:underline"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteComment(c.id)}
                                    className="text-[#F43F5E] hover:underline"
                                  >
                                    Hapus
                                  </button>
                                </span>
                              )}
                            </div>

                            {editingCommentId === c.id ? (
                              <div
                                className="mt-1 flex gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  value={editingBody}
                                  onChange={(e) => setEditingBody(e.target.value)}
                                  className="flex-1 rounded border border-[#141414] px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!editingBody.trim()) return;
                                    await onEditComment(c.id, editingBody.trim());
                                    setEditingCommentId(null);
                                  }}
                                  className="rounded bg-[#141414] px-2 py-1 text-[11px] font-semibold text-[#F3F3EF]"
                                >
                                  Simpan
                                </button>
                              </div>
                            ) : (
                              <p
                                className={`mt-0.5 whitespace-pre-wrap break-words ${
                                  c.deleted_at ? "italic text-[#787872]" : "text-[#141414]"
                                }`}
                              >
                                {c.deleted_at ? "Komentar dihapus" : c.body}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {pin.client_meta?.viewport && (
                        <p className="font-mono-data mt-2 text-[10px] text-[#787872]">
                          {pin.client_meta.viewport}
                        </p>
                      )}

                      {isSel && (
                        <div
                          className="mt-2.5 border-t border-[#DFDFD8] pt-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isDraft && !locked && (
                            <form
                              onSubmit={(e) => handleReplySubmit(e, pin.id)}
                              className="mb-2 flex gap-1.5"
                            >
                              <input
                                value={replyDrafts[pin.id] ?? ""}
                                onChange={(e) =>
                                  setReplyDrafts((prev) => ({
                                    ...prev,
                                    [pin.id]: e.target.value,
                                  }))
                                }
                                placeholder="Balas komentar..."
                                className="min-h-[34px] flex-1 rounded border border-[#C9C9C0] px-2.5 text-xs focus:border-[#141414] focus:outline-none"
                              />
                              <button
                                type="submit"
                                aria-label="Kirim balasan"
                                className="inline-flex min-h-[34px] items-center justify-center rounded bg-[#141414] px-2.5 text-xs font-semibold text-[#F3F3EF]"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            {actorRole === "owner" && !locked && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onChangePinStatus(pin.id, "in_progress")}
                                  className="min-h-[30px] rounded border border-[#C9C9C0] bg-white px-2.5 text-[11px] font-semibold hover:border-[#141414]"
                                >
                                  In Progress
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChangePinStatus(pin.id, "resolved")}
                                  className="min-h-[30px] rounded border border-[#C9C9C0] bg-white px-2.5 text-[11px] font-semibold hover:border-[#141414]"
                                >
                                  Resolve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeletePin(pin.id)}
                                  className="inline-flex min-h-[30px] items-center gap-1 rounded border border-rose-300 px-2.5 text-[11px] font-semibold text-[#F43F5E] hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3 w-3" /> Hapus Pin
                                </button>
                              </>
                            )}
                            {actorRole === "client" &&
                              !locked &&
                              !isDraft &&
                              isOwnClientPin &&
                              pin.status !== "open" && (
                                <button
                                  type="button"
                                  onClick={() => onChangePinStatus(pin.id, "open")}
                                  className="inline-flex min-h-[30px] items-center gap-1 rounded border border-[#C9C9C0] bg-white px-2.5 text-[11px] font-semibold"
                                >
                                  <RotateCcw className="h-3 w-3" /> Buka lagi
                                </button>
                              )}
                            {actorRole === "client" && !locked && isDraft && (
                              <button
                                type="button"
                                onClick={() => onDeletePin(pin.id)}
                                className="inline-flex min-h-[30px] items-center gap-1 rounded border border-rose-300 px-2.5 text-[11px] font-semibold text-[#F43F5E]"
                              >
                                <Trash2 className="h-3 w-3" /> Hapus Draft
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* C07 Sticky Draft Bar */}
      {actorRole === "client" && draftCount > 0 && !locked && (
        <div
          className={`${
            mobileSheetOpen ? "flex" : "hidden md:flex"
          } items-center justify-between gap-2 bg-[#141414] px-3.5 py-2.5 text-[#F3F3EF]`}
        >
          <span className="text-xs">
            <strong>{draftCount}</strong> feedback belum dikirim
          </span>
          <button
            type="button"
            disabled={submittingDrafts}
            onClick={onSubmitDrafts}
            className="min-h-[34px] rounded bg-[#F3F3EF] px-3 text-xs font-bold text-[#141414] disabled:opacity-50"
          >
            {submittingDrafts ? "Mengirim..." : `Kirim Semua Feedback (${draftCount})`}
          </button>
        </div>
      )}
    </aside>
  );
}
