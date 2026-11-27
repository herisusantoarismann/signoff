import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import { assertCanMutateReview } from "@/lib/future/revision-policy";
import { handleApiError } from "@/lib/supabase/http";
import { requireReviewContext } from "@/lib/supabase/review-http";
import type { DesignVersionRecord } from "@/lib/domain/types";

async function loadCommentContext(projectId: string, commentId: string) {
  const admin = createAdminSupabaseClient();
  const { data: comment } = await admin
    .from("pin_comments")
    .select("*")
    .eq("id", commentId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!comment) return null;

  const { data: pin } = await admin
    .from("pins")
    .select("frame_id, submitted_at")
    .eq("id", comment.pin_id)
    .single();
  const { data: frame } = await admin
    .from("design_frames")
    .select("version_id")
    .eq("id", pin?.frame_id)
    .single();
  const { data: version } = await admin
    .from("design_versions")
    .select("*")
    .eq("id", frame?.version_id)
    .single();

  return { comment, pin, version: version as DesignVersionRecord };
}

function isCommentAuthor(
  comment: { author_role: string; author_session_id: string | null },
  actor: { role: string; guestId?: string }
): boolean {
  if (actor.role === "owner") return comment.author_role === "owner";
  return Boolean(actor.guestId && comment.author_session_id === actor.guestId);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ token: string; commentId: string }> }
) {
  try {
    const { token, commentId } = await context.params;
    const ctx = await requireReviewContext(token);
    if ("response" in ctx) return ctx.response;

    const loaded = await loadCommentContext(ctx.project.id, commentId);
    if (!loaded) {
      return NextResponse.json({ error: "Komentar tidak ditemukan." }, { status: 404 });
    }

    assertCanMutateReview({
      project: ctx.project,
      version: loaded.version,
      actorRole: ctx.actor.role,
    });

    if (!isCommentAuthor(loaded.comment, ctx.actor)) {
      return NextResponse.json(
        { error: "Kamu hanya bisa mengedit komentar milik sendiri." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Isi komentar tidak boleh kosong." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: updated, error } = await admin
      .from("pin_comments")
      .update({ body: text, edited_at: new Date().toISOString() })
      .eq("id", commentId)
      .select("*")
      .single();

    if (error) throw error;

    if (loaded.pin?.submitted_at !== null) {
      await broadcastReviewEvent(ctx.project.share_token, "comment_updated", {
        comment: updated,
      });
    }

    return NextResponse.json({ comment: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ token: string; commentId: string }> }
) {
  try {
    const { token, commentId } = await context.params;
    const ctx = await requireReviewContext(token);
    if ("response" in ctx) return ctx.response;

    const loaded = await loadCommentContext(ctx.project.id, commentId);
    if (!loaded) {
      return NextResponse.json({ error: "Komentar tidak ditemukan." }, { status: 404 });
    }

    assertCanMutateReview({
      project: ctx.project,
      version: loaded.version,
      actorRole: ctx.actor.role,
    });

    if (!isCommentAuthor(loaded.comment, ctx.actor)) {
      return NextResponse.json(
        { error: "Kamu hanya bisa menghapus komentar milik sendiri." },
        { status: 403 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: updated, error } = await admin
      .from("pin_comments")
      .update({ body: "", deleted_at: new Date().toISOString() })
      .eq("id", commentId)
      .select("*")
      .single();

    if (error) throw error;

    if (loaded.pin?.submitted_at !== null) {
      await admin.from("project_activity").insert({
        project_id: ctx.project.id,
        actor_name: ctx.actor.name,
        action_type: "comment_deleted",
        metadata: { commentId },
      });
      await broadcastReviewEvent(ctx.project.share_token, "comment_updated", {
        comment: updated,
      });
    }

    return NextResponse.json({ comment: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
