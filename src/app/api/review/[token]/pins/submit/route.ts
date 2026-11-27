import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import { assertCanCreatePin } from "@/lib/future/revision-policy";
import { handleApiError } from "@/lib/supabase/http";
import { requireReviewContext } from "@/lib/supabase/review-http";
import type { DesignVersionRecord, PinCommentRecord } from "@/lib/domain/types";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const ctx = await requireReviewContext(token);
    if ("response" in ctx) return ctx.response;

    if (ctx.actor.role !== "client" || !ctx.actor.guestId) {
      return NextResponse.json(
        { error: "Hanya klien yang memiliki draft feedback." },
        { status: 403 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: drafts } = await admin
      .from("pins")
      .select("*, design_frames!inner(version_id)")
      .eq("project_id", ctx.project.id)
      .eq("author_session_id", ctx.actor.guestId)
      .is("submitted_at", null);

    if (!drafts || drafts.length === 0) {
      return NextResponse.json({ submittedCount: 0, byVersion: {} });
    }

    const versionIds = Array.from(
      new Set(drafts.map((d) => (d.design_frames as { version_id: string }).version_id))
    );
    const { data: versions } = await admin
      .from("design_versions")
      .select("*")
      .in("id", versionIds);

    const versionMap = new Map(
      ((versions ?? []) as DesignVersionRecord[]).map((v) => [v.id, v])
    );

    for (const v of versionMap.values()) {
      assertCanCreatePin({ project: ctx.project, version: v, actorRole: "client" });
    }

    const draftIds = drafts.map((d) => d.id);
    const now = new Date().toISOString();

    const { error: updErr } = await admin
      .from("pins")
      .update({ submitted_at: now })
      .in("id", draftIds);
    if (updErr) throw updErr;

    const [{ data: updatedPins }, { data: comments }] = await Promise.all([
      admin.from("pins").select("*").in("id", draftIds),
      admin.from("pin_comments").select("*").in("pin_id", draftIds),
    ]);

    const byVersion: Record<string, number> = {};
    for (const d of drafts) {
      const vid = (d.design_frames as { version_id: string }).version_id;
      const lbl = versionMap.get(vid)?.label ?? "v1";
      byVersion[lbl] = (byVersion[lbl] ?? 0) + 1;
    }

    await admin.from("project_activity").insert({
      project_id: ctx.project.id,
      actor_name: ctx.actor.name,
      action_type: "feedback_submitted",
      metadata: { count: draftIds.length, byVersion },
    });

    for (const p of updatedPins ?? []) {
      const pinComments = ((comments ?? []) as PinCommentRecord[]).filter(
        (c) => c.pin_id === p.id
      );
      await broadcastReviewEvent(ctx.project.share_token, "pin_created", {
        pin: { ...p, comments: pinComments },
      });
    }

    return NextResponse.json({
      submittedCount: draftIds.length,
      byVersion,
      submittedAt: now,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
