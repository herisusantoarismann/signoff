import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import { assertCanMutateReview } from "@/lib/future/revision-policy";
import { handleApiError } from "@/lib/supabase/http";
import { requireReviewContext } from "@/lib/supabase/review-http";
import type { DesignVersionRecord, PinCategory, PinCommentRecord, PinStatus } from "@/lib/domain/types";

const ALLOWED_CATS = new Set<PinCategory>(["copy", "layout", "visual", "bug", "general"]);
const ALLOWED_STATUSES = new Set<PinStatus>(["open", "in_progress", "resolved"]);

async function loadPinAndVersion(projectId: string, pinId: string) {
  const admin = createAdminSupabaseClient();
  const { data: pin } = await admin
    .from("pins")
    .select("*")
    .eq("id", pinId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!pin) return null;

  const { data: frame } = await admin
    .from("design_frames")
    .select("version_id")
    .eq("id", pin.frame_id)
    .single();

  const { data: version } = await admin
    .from("design_versions")
    .select("*")
    .eq("id", frame?.version_id)
    .single();

  return { pin, version: version as DesignVersionRecord };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ token: string; pinId: string }> }
) {
  try {
    const { token, pinId } = await context.params;
    const ctx = await requireReviewContext(token);
    if ("response" in ctx) return ctx.response;

    const loaded = await loadPinAndVersion(ctx.project.id, pinId);
    if (!loaded) {
      return NextResponse.json({ error: "Pin tidak ditemukan." }, { status: 404 });
    }

    assertCanMutateReview({
      project: ctx.project,
      version: loaded.version,
      actorRole: ctx.actor.role,
    });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    const isOwner = ctx.actor.role === "owner";
    const isOwnClientPin =
      ctx.actor.role === "client" &&
      ctx.actor.guestId &&
      loaded.pin.author_session_id === ctx.actor.guestId;

    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Status pin tidak valid." }, { status: 400 });
      }
      if (isOwner) {
        updates.status = body.status;
      } else if (
        isOwnClientPin &&
        loaded.pin.submitted_at !== null &&
        body.status === "open" &&
        loaded.pin.status !== "open"
      ) {
        updates.status = "open";
      } else {
        return NextResponse.json(
          { error: "Kamu tidak memiliki izin mengubah status pin ini." },
          { status: 403 }
        );
      }
    }

    if (body.category !== undefined) {
      if (!ALLOWED_CATS.has(body.category)) {
        return NextResponse.json({ error: "Kategori pin tidak valid." }, { status: 400 });
      }
      if (!isOwner && !isOwnClientPin) {
        return NextResponse.json(
          { error: "Kamu tidak memiliki izin mengubah kategori pin ini." },
          { status: 403 }
        );
      }
      updates.category = body.category;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: updated, error } = await admin
      .from("pins")
      .update(updates)
      .eq("id", pinId)
      .select("*")
      .single();
    if (error) throw error;

    const { data: comments } = await admin
      .from("pin_comments")
      .select("*")
      .eq("pin_id", pinId)
      .order("created_at", { ascending: true });

    const fullPin = { ...updated, comments: (comments ?? []) as PinCommentRecord[] };

    if (updated.submitted_at !== null && updates.status) {
      const actionType = updates.status === "resolved" ? "pin_resolved" : "pin_status_changed";
      await admin.from("project_activity").insert({
        project_id: ctx.project.id,
        actor_name: ctx.actor.name,
        action_type: actionType,
        metadata: { pinNumber: updated.pin_number, status: updates.status },
      });
      await broadcastReviewEvent(ctx.project.share_token, "pin_updated", { pin: fullPin });
    } else if (updated.submitted_at !== null) {
      await broadcastReviewEvent(ctx.project.share_token, "pin_updated", { pin: fullPin });
    }

    return NextResponse.json({ pin: fullPin });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ token: string; pinId: string }> }
) {
  try {
    const { token, pinId } = await context.params;
    const ctx = await requireReviewContext(token);
    if ("response" in ctx) return ctx.response;

    const loaded = await loadPinAndVersion(ctx.project.id, pinId);
    if (!loaded) {
      return NextResponse.json({ error: "Pin tidak ditemukan." }, { status: 404 });
    }

    assertCanMutateReview({
      project: ctx.project,
      version: loaded.version,
      actorRole: ctx.actor.role,
    });

    const isOwner = ctx.actor.role === "owner";
    const isOwnDraft =
      ctx.actor.role === "client" &&
      loaded.pin.submitted_at === null &&
      ctx.actor.guestId &&
      loaded.pin.author_session_id === ctx.actor.guestId;

    if (!isOwner && !isOwnDraft) {
      return NextResponse.json(
        { error: "Kamu hanya bisa menghapus draft milik sendiri." },
        { status: 403 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: comments } = await admin
      .from("pin_comments")
      .select("body")
      .eq("pin_id", pinId)
      .order("created_at", { ascending: true })
      .limit(1);

    const { error } = await admin.from("pins").delete().eq("id", pinId);
    if (error) throw error;

    if (loaded.pin.submitted_at !== null) {
      await admin.from("project_activity").insert({
        project_id: ctx.project.id,
        actor_name: ctx.actor.name,
        action_type: "pin_deleted",
        metadata: {
          pinNumber: loaded.pin.pin_number,
          firstComment: comments?.[0]?.body ?? "",
        },
      });
      await broadcastReviewEvent(ctx.project.share_token, "pin_deleted", { pinId });
    }

    return NextResponse.json({ deleted: true, pinId });
  } catch (err) {
    return handleApiError(err);
  }
}
