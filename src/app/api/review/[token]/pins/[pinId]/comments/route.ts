import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import { assertCanMutateReview } from "@/lib/future/revision-policy";
import { handleApiError } from "@/lib/supabase/http";
import { requireReviewContext } from "@/lib/supabase/review-http";
import type { DesignVersionRecord } from "@/lib/domain/types";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string; pinId: string }> }
) {
  try {
    const { token, pinId } = await context.params;
    const ctx = await requireReviewContext(token);
    if ("response" in ctx) return ctx.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const commentText = typeof body.body === "string" ? body.body.trim() : "";
    if (!commentText) {
      return NextResponse.json({ error: "Komentar tidak boleh kosong." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: pin } = await admin
      .from("pins")
      .select("*")
      .eq("id", pinId)
      .eq("project_id", ctx.project.id)
      .maybeSingle();

    if (!pin) {
      return NextResponse.json({ error: "Pin tidak ditemukan." }, { status: 404 });
    }
    if (pin.submitted_at === null) {
      return NextResponse.json(
        { error: "Pin masih berstatus draft. Kirim feedback terlebih dahulu." },
        { status: 409 }
      );
    }

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

    assertCanMutateReview({
      project: ctx.project,
      version: version as DesignVersionRecord,
      actorRole: ctx.actor.role,
    });

    const { data: comment, error } = await admin
      .from("pin_comments")
      .insert({
        pin_id: pinId,
        project_id: ctx.project.id,
        author_name: ctx.actor.name,
        author_role: ctx.actor.role,
        author_session_id: ctx.actor.guestId ?? null,
        body: commentText,
      })
      .select("*")
      .single();

    if (error) throw error;

    await admin.from("project_activity").insert({
      project_id: ctx.project.id,
      actor_name: ctx.actor.name,
      action_type: "comment_added",
      metadata: { pinNumber: pin.pin_number },
    });

    await broadcastReviewEvent(ctx.project.share_token, "comment_created", {
      comment,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
