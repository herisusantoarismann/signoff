import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { handleApiError, requireOwnerProject } from "@/lib/supabase/http";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: projectId, versionId } = await context.params;
    const check = await requireOwnerProject(projectId);
    if ("response" in check) return check.response;

    const admin = createAdminSupabaseClient();
    const { data: version } = await admin
      .from("design_versions")
      .select("*")
      .eq("id", versionId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (!version) {
      return NextResponse.json({ error: "Versi tidak ditemukan." }, { status: 404 });
    }
    if (version.status === "approved") {
      return NextResponse.json(
        { error: "Versi yang sudah di-ACC tidak dapat diubah." },
        { status: 409 }
      );
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.status === "in_review" || body.status === "changes_requested") {
      updates.status = body.status;
    }
    if (typeof body.notes === "string") {
      updates.notes = body.notes.trim();
    }

    const { data: updated, error } = await admin
      .from("design_versions")
      .update(updates)
      .eq("id", versionId)
      .select("*")
      .single();

    if (error) throw error;

    if (updates.status === "changes_requested") {
      await admin.from("project_activity").insert({
        project_id: projectId,
        actor_name: check.owner.studioName || check.owner.email || "Desainer",
        action_type: "changes_requested",
        metadata: { versionLabel: version.label },
      });
    }

    return NextResponse.json({ version: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
