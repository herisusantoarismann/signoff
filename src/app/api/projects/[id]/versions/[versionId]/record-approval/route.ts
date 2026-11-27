import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import {
  assertCanRecordApproval,
  buildOwnerRecordedStatement,
} from "@/lib/future/revision-policy";
import { handleApiError, requireOwnerProject } from "@/lib/supabase/http";
import type { ApprovalSource, DesignVersionRecord } from "@/lib/domain/types";

const ALLOWED_SOURCES = new Set<ApprovalSource>(["whatsapp", "email", "meeting", "other"]);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: projectId, versionId } = await context.params;
    const check = await requireOwnerProject(projectId);
    if ("response" in check) return check.response;

    const body = await req.json();
    const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
    const source: ApprovalSource = ALLOWED_SOURCES.has(body.source) ? body.source : "whatsapp";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 240) : null;

    const admin = createAdminSupabaseClient();
    const { data: versions } = await admin
      .from("design_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false });

    const allVersions = (versions ?? []) as DesignVersionRecord[];
    const latestVersion = allVersions[0];
    const targetVersion = allVersions.find((v) => v.id === versionId);
    if (!latestVersion || !targetVersion) {
      return NextResponse.json({ error: "Versi tidak ditemukan." }, { status: 404 });
    }

    assertCanRecordApproval({
      project: check.project,
      latestVersion,
      targetVersion,
      actorRole: "owner",
      clientName,
      source,
    });

    const ownerName = check.owner.studioName || check.owner.email || "Desainer";
    const statement = buildOwnerRecordedStatement({ ownerName, clientName, source });
    const now = new Date().toISOString();

    const { data: updated, error } = await admin
      .from("design_versions")
      .update({
        status: "approved",
        approved_by_name: clientName,
        approved_at: now,
        approval_statement: statement,
        approval_method: "owner_recorded",
        approval_source: source,
        approval_note: note,
      })
      .eq("id", versionId)
      .select("*")
      .single();

    if (error) throw error;

    await admin.from("project_activity").insert({
      project_id: projectId,
      actor_name: ownerName,
      action_type: "version_approved",
      metadata: {
        versionLabel: targetVersion.label,
        approvalMethod: "owner_recorded",
        source,
      },
    });

    await broadcastReviewEvent(check.project.share_token, "version_approved", {
      version: updated,
    });

    return NextResponse.json({ version: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
