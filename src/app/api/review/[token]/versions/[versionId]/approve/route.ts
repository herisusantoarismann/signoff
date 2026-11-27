import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import {
  assertCanApproveVersion,
  buildApprovalStatement,
} from "@/lib/future/revision-policy";
import { handleApiError } from "@/lib/supabase/http";
import { requireReviewContext } from "@/lib/supabase/review-http";
import type { DesignVersionRecord } from "@/lib/domain/types";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string; versionId: string }> }
) {
  try {
    const { token, versionId } = await context.params;
    const ctx = await requireReviewContext(token);
    if ("response" in ctx) return ctx.response;

    const body = await req.json().catch(() => ({}));
    const confirmName = typeof body.confirmName === "string" ? body.confirmName : "";
    const agreed = body.agreed === true;

    const admin = createAdminSupabaseClient();
    const { data: versions } = await admin
      .from("design_versions")
      .select("*")
      .eq("project_id", ctx.project.id)
      .order("version_number", { ascending: false });

    const allVersions = (versions ?? []) as DesignVersionRecord[];
    const latestVersion = allVersions[0];
    const targetVersion = allVersions.find((v) => v.id === versionId);

    if (!latestVersion || !targetVersion) {
      return NextResponse.json({ error: "Versi tidak ditemukan." }, { status: 404 });
    }

    assertCanApproveVersion({
      project: ctx.project,
      latestVersion,
      targetVersion,
      actorRole: ctx.actor.role,
      actorName: ctx.actor.name,
      confirmName,
      agreed,
    });

    const now = new Date().toISOString();
    const statement = buildApprovalStatement({
      versionLabel: targetVersion.label,
      actorName: ctx.actor.name,
    });

    const { data: updated, error } = await admin
      .from("design_versions")
      .update({
        status: "approved",
        approved_by_name: ctx.actor.name,
        approved_at: now,
        approval_statement: statement,
        approval_method: "client_link",
      })
      .eq("id", versionId)
      .select("*")
      .single();

    if (error) throw error;

    await admin.from("project_activity").insert({
      project_id: ctx.project.id,
      actor_name: ctx.actor.name,
      action_type: "version_approved",
      metadata: {
        versionLabel: targetVersion.label,
        approvalMethod: "client_link",
      },
    });

    await broadcastReviewEvent(ctx.project.share_token, "version_approved", {
      version: updated,
    });

    return NextResponse.json({ version: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
