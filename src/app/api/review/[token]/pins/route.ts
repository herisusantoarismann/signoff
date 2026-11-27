import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import { clamp01 } from "@/lib/canvas/coordinates";
import { assertCanCreatePin } from "@/lib/future/revision-policy";
import { handleApiError } from "@/lib/supabase/http";
import { requireReviewContext } from "@/lib/supabase/review-http";
import type { DesignVersionRecord, PinCategory, PinCommentRecord, PinKind } from "@/lib/domain/types";

const ALLOWED_CATS = new Set<PinCategory>(["copy", "layout", "visual", "bug", "general"]);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const ctx = await requireReviewContext(token);
    if ("response" in ctx) return ctx.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const frameId = typeof body.frameId === "string" ? body.frameId : "";
    const kind: PinKind = body.kind === "box" ? "box" : "point";
    const category: PinCategory = ALLOWED_CATS.has(body.category) ? body.category : "general";
    const commentBody = typeof body.body === "string" ? body.body.trim() : "";

    if (!frameId || !commentBody) {
      return NextResponse.json(
        { error: "Frame dan isi komentar wajib diisi." },
        { status: 400 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: frame } = await admin
      .from("design_frames")
      .select("id, version_id, project_id")
      .eq("id", frameId)
      .eq("project_id", ctx.project.id)
      .maybeSingle();

    if (!frame) {
      return NextResponse.json({ error: "Frame tidak ditemukan." }, { status: 404 });
    }

    const { data: version } = await admin
      .from("design_versions")
      .select("*")
      .eq("id", frame.version_id)
      .single();

    assertCanCreatePin({
      project: ctx.project,
      version: version as DesignVersionRecord,
      actorRole: ctx.actor.role,
    });

    const xNorm = clamp01(Number(body.xNorm));
    const yNorm = clamp01(Number(body.yNorm));
    const wNorm = kind === "box" ? clamp01(Number(body.wNorm)) : null;
    const hNorm = kind === "box" ? clamp01(Number(body.hNorm)) : null;
    const isOwner = ctx.actor.role === "owner";
    const submittedAt = isOwner ? new Date().toISOString() : null;

    const { data: rpcRows, error: rpcErr } = await admin.rpc("create_pin", {
      p_frame_id: frameId,
      p_kind: kind,
      p_category: category,
      p_x_norm: xNorm,
      p_y_norm: yNorm,
      p_w_norm: wNorm,
      p_h_norm: hNorm,
      p_client_meta: body.clientMeta ?? null,
      p_author_name: ctx.actor.name,
      p_author_role: ctx.actor.role,
      p_author_session_id: ctx.actor.guestId ?? null,
      p_submitted_at: submittedAt,
      p_body: commentBody,
    });

    if (rpcErr) throw rpcErr;
    const created = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

    const [{ data: pinRow }, { data: commentRows }] = await Promise.all([
      admin.from("pins").select("*").eq("id", created.pin_id).single(),
      admin.from("pin_comments").select("*").eq("pin_id", created.pin_id),
    ]);

    const fullPin = {
      ...pinRow,
      comments: (commentRows ?? []) as PinCommentRecord[],
    };

    if (isOwner) {
      await admin.from("project_activity").insert({
        project_id: ctx.project.id,
        actor_name: ctx.actor.name,
        action_type: "pin_created",
        metadata: { pinNumber: fullPin.pin_number, versionLabel: version.label },
      });
      await broadcastReviewEvent(ctx.project.share_token, "pin_created", { pin: fullPin });
    }

    return NextResponse.json({ pin: fullPin }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
